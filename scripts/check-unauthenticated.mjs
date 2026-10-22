const accountEndpoint = "http://localhost:3000/api/account";
const withdrawalEndpoint = "http://localhost:3000/api/withdrawals";
const faceProfileEndpoint = "http://localhost:3000/api/face-profile";

const withoutToken = await fetch(accountEndpoint);
if (withoutToken.status !== 401) {
  throw new Error(`Expected 401 without a token, received ${withoutToken.status}`);
}

const browserClaim = await fetch(accountEndpoint, {
  headers: { "x-role": "account:joint-owner", "x-user": "owner-a" },
});
if (browserClaim.status !== 401) {
  throw new Error(`Expected 401 for an untrusted browser role, received ${browserClaim.status}`);
}

const invalidToken = await fetch(accountEndpoint, {
  headers: { Authorization: "Bearer not-a-valid-tide-token" },
});
if (invalidToken.status !== 401) {
  throw new Error(`Expected 401 for an invalid token, received ${invalidToken.status}`);
}

const forgedWithdrawal = await fetch(withdrawalEndpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-role": "account:joint-owner" },
  body: JSON.stringify({ amountVnd: 5000000, recipientName: "Test", recipientBank: "Demo", accountLast4: "1234" }),
});
if (forgedWithdrawal.status !== 401) {
  throw new Error(`Expected 401 for a forged withdrawal request, received ${forgedWithdrawal.status}`);
}

const forgedFaceEnrollment = await fetch(faceProfileEndpoint, {
  method: "PUT",
  headers: { "Content-Type": "application/json", "x-role": "account:joint-owner" },
  body: JSON.stringify({ consent: true, embeddings: [] }),
});
if (forgedFaceEnrollment.status !== 401) {
  throw new Error(`Expected 401 for a forged face enrollment, received ${forgedFaceEnrollment.status}`);
}

console.log("PASS unauthenticated request -> 401");
console.log("PASS browser-supplied role without token -> 401");
console.log("PASS invalid bearer token -> 401");
console.log("PASS forged withdrawal identity/role -> 401");
console.log("PASS forged face enrollment identity/role -> 401");
