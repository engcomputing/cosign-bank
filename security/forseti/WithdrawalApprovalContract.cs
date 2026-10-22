using Ork.Forseti.Sdk;
using Cryptide.Tools;
using Ork.Shared.Models.Contracts;
using System;
using System.Collections.Generic;
using System.Text;

public class Contract : IAccessPolicy
{
    [PolicyParam(Required = true, Description = "OIDC client resource containing the joint-owner role")]
    public string Resource { get; set; }

    [PolicyParam(Required = true, Description = "Client role held by each registered co-owner")]
    public string OwnerRole { get; set; }

    [PolicyParam(Default = 2, Min = 2, Max = 2, Description = "Exactly two other co-owners must approve")]
    public int MinApprovers { get; set; }

    [PolicyParam(Default = 100000000, Min = 100000, Description = "Maximum permitted amount in whole VND")]
    public long MaxAmountVnd { get; set; }

    [PolicyParam(Default = 180, Min = 60, Max = 300, Description = "Maximum approval window in seconds")]
    public int ApprovalWindowSeconds { get; set; }

    private const int F_VERSION = 0;
    private const int F_INITIATOR_VUID = 1;
    private const int F_WITHDRAWAL_ID = 2;
    private const int F_AMOUNT_VND = 3;
    private const int F_CURRENCY = 4;
    private const int F_DESTINATION_FINGERPRINT = 5;
    private const int F_EXPIRES_AT = 6;
    private const int WIRE_FIELD_COUNT = 7;

    private bool _dataValidated = false;
    private string _initiatorVuid = null;

    public PolicyDecision ValidateData(DataContext ctx)
    {
        if (ctx.Policy.ExecutionType != ExecutionType.PRIVATE ||
            ctx.Policy.ApprovalType != ApprovalType.EXPLICIT)
        {
            return PolicyDecision.Deny("Joint withdrawals require an EXPLICIT PRIVATE policy");
        }

        ReadOnlyMemory<byte> data = ctx.Data;
        if (!TryReadText(data, F_VERSION, out var version) || version != "1")
            return PolicyDecision.Deny("Unsupported withdrawal payload version");
        if (!TryReadText(data, F_INITIATOR_VUID, out var initiatorVuid) || initiatorVuid.Length > 128)
            return PolicyDecision.Deny("Missing or invalid initiator vuid");
        if (!TryReadText(data, F_WITHDRAWAL_ID, out var withdrawalId) || withdrawalId.Length > 80)
            return PolicyDecision.Deny("Missing or invalid withdrawal id");
        if (!TryReadText(data, F_AMOUNT_VND, out var amountText) ||
            !long.TryParse(amountText, out var amountVnd) || amountVnd < 100000 || amountVnd > MaxAmountVnd)
            return PolicyDecision.Deny("Withdrawal amount is outside the policy limit");
        if (!TryReadText(data, F_CURRENCY, out var currency) || currency != "VND")
            return PolicyDecision.Deny("Only VND withdrawals are allowed");
        if (!TryReadText(data, F_DESTINATION_FINGERPRINT, out var destination) ||
            destination.Length < 8 || destination.Length > 128)
            return PolicyDecision.Deny("Invalid destination fingerprint");
        if (!TryReadText(data, F_EXPIRES_AT, out var expiryText) ||
            !long.TryParse(expiryText, out var expiresAt))
            return PolicyDecision.Deny("Invalid approval expiry");
        if (data.TryGetValue(WIRE_FIELD_COUNT, out var _))
            return PolicyDecision.Deny("Unexpected withdrawal payload fields");

        var now = Utils.GetEpochSeconds();
        if (expiresAt <= now || expiresAt > now + ApprovalWindowSeconds)
            return PolicyDecision.Deny("Approval window is expired or too long");

        _initiatorVuid = initiatorVuid;
        _dataValidated = true;
        return PolicyDecision.Allow();
    }

    public PolicyDecision ValidateApprovers(ApproversContext ctx)
    {
        if (!_dataValidated || string.IsNullOrEmpty(_initiatorVuid))
            return PolicyDecision.Deny("Withdrawal data was not validated");

        var approvers = DokenDto.WrapAll(ctx.Dokens);
        var distinctApproverIds = new List<string>();
        foreach (var approver in approvers)
        {
            if (approver.IsNull || approver.IsExpired) continue;
            if (approver.UserId == _initiatorVuid)
                return PolicyDecision.Deny("The requester cannot approve their own withdrawal");
            if (!approver.HasRole(Resource, OwnerRole)) continue;
            if (!distinctApproverIds.Contains(approver.UserId))
                distinctApproverIds.Add(approver.UserId);
        }

        if (distinctApproverIds.Count < MinApprovers)
            return PolicyDecision.Deny("Two distinct co-owner approvals are required");
        return PolicyDecision.Allow();
    }

    public PolicyDecision ValidateExecutor(ExecutorContext ctx)
    {
        if (!_dataValidated || string.IsNullOrEmpty(_initiatorVuid))
            return PolicyDecision.Deny("Withdrawal data was not validated");

        var executor = new DokenDto(ctx.Doken);
        if (executor.IsNull || executor.IsExpired)
            return PolicyDecision.Deny("Executor credential is invalid or expired");
        if (executor.UserId != _initiatorVuid)
            return PolicyDecision.Deny("Only the original requester may execute this withdrawal");
        if (!executor.HasRole(Resource, OwnerRole))
            return PolicyDecision.Deny("Executor is not a registered co-owner");
        return PolicyDecision.Allow();
    }

    private static bool TryReadText(ReadOnlyMemory<byte> data, int index, out string value)
    {
        if (!data.TryGetValue(index, out var leaf))
        {
            value = string.Empty;
            return false;
        }
        value = Encoding.UTF8.GetString(leaf.Span);
        return !string.IsNullOrEmpty(value);
    }
}
