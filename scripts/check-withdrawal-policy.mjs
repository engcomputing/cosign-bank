import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contract = await readFile("security/forseti/WithdrawalApprovalContract.cs", "utf8");
const manifest = JSON.parse(await readFile("security/forseti/policy-manifest.json", "utf8"));

test("manifest declares the 2-of-3 explicit private policy", () => {
  assert.equal(manifest.minApprovers, 2);
  assert.equal(manifest.approvalType, "EXPLICIT");
  assert.equal(manifest.executionType, "PRIVATE");
  assert.equal(manifest.approvalWindowSeconds, 180);
  assert.match(manifest.modelId, /^BasicCustom<.+>:BasicCustom<.+>$/);
});

test("contract has the Forseti entry shape and fail-closed validators", () => {
  assert.match(contract, /using\s+Ork\.Forseti\.Sdk\s*;/);
  assert.match(contract, /class\s+Contract\s*:\s*IAccessPolicy/);
  assert.doesNotMatch(contract, /PolicyDecision\.Approve/);
  assert.match(contract, /PolicyDecision\s+ValidateData/);
  assert.match(contract, /PolicyDecision\s+ValidateApprovers/);
  assert.match(contract, /PolicyDecision\s+ValidateExecutor/);
  assert.match(contract, /_dataValidated[\s\S]{0,180}PolicyDecision\.Deny/);
});

test("contract prevents self approval and counts distinct owner identities", () => {
  assert.match(contract, /approver\.UserId\s*==\s*_initiatorVuid/);
  assert.match(contract, /distinctApproverIds\.Contains\(approver\.UserId\)/);
  assert.match(contract, /distinctApproverIds\.Count\s*<\s*MinApprovers/);
  assert.match(contract, /approver\.HasRole\(Resource,\s*OwnerRole\)/);
});

test("contract binds execution to the requester and short approval window", () => {
  assert.match(contract, /executor\.UserId\s*!=\s*_initiatorVuid/);
  assert.match(contract, /executor\.HasRole\(Resource,\s*OwnerRole\)/);
  assert.match(contract, /Utils\.GetEpochSeconds\(\)/);
  assert.match(contract, /expiresAt\s*>\s*now\s*\+\s*ApprovalWindowSeconds/);
});

test("contract does not use browser identity claims or blocked APIs", () => {
  assert.doesNotMatch(contract, /\bsubject\b/i);
  assert.doesNotMatch(contract, /DateTime\.(Now|UtcNow)|Guid\.NewGuid|System\.(IO|Net|Threading|Reflection|Diagnostics|Console)/);
});
