const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/unauthorized-domain": "This app domain is not authorized in Firebase Authentication.",
  "auth/invalid-api-key": "Firebase client configuration is missing or invalid.",
  "auth/app-not-authorized": "Firebase client configuration is missing or invalid.",
  membership_required: "This account is not an active Rabbit Bytes member. Contact an administrator for access.",
  sign_in_failed: "Sign in failed. Check your credentials and access with an administrator.",
};

export function getLoginErrorMessage(code: unknown): string {
  return typeof code === "string"
    ? (LOGIN_ERROR_MESSAGES[code] ?? LOGIN_ERROR_MESSAGES.sign_in_failed)
    : LOGIN_ERROR_MESSAGES.sign_in_failed;
}
