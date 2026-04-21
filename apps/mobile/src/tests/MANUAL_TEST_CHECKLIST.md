# PrajaShakti Mobile — Manual Auth Test Checklist

Mirrors the API integration tests in `apps/api/tests/routes/auth.test.js`.
Run on **Android emulator** (`npm run android`) and **iOS** (`npm run ios`) independently.

> **Prerequisites**
>
> - `npm run dev` (starts API on port 3000 + web on 5173)
> - `npm run android` or `npm run ios` in a separate terminal
> - API must show `Env: development` so `debug_otp` is returned

---

## 1. Welcome Screen

| #   | Step                              | Expected                                                                                 |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| 1.1 | Open app fresh (no saved session) | Welcome screen shown with gradient background                                            |
| 1.2 | Check heading text                | "Welcome"                                                                                |
| 1.3 | Check description text            | "Hold your local government accountable. One citizen at a time."                         |
| 1.4 | Check primary button text         | "I'm new here — Register"                                                                |
| 1.5 | Check secondary button text       | "I have an account — Login"                                                              |
| 1.6 | Check footer text                 | "By continuing, you agree to our Terms of Service. No spam. No corporate funding. Ever." |
| 1.7 | Logo animations play              | Triangle logo scales in, card slides up, buttons fade in                                 |

---

## 2. Register Screen — Field Validation

| #    | Step                                           | Expected                                           |
| ---- | ---------------------------------------------- | -------------------------------------------------- |
| 2.1  | Tap "I'm new here — Register"                  | Register screen appears                            |
| 2.2  | Check heading                                  | "Create your account"                              |
| 2.3  | Check sub-text                                 | "Enter your name and phone number"                 |
| 2.4  | Check name label                               | "Your name" (lowercase n)                          |
| 2.5  | Check name placeholder                         | "Arjun Sharma"                                     |
| 2.6  | Check phone label                              | "Mobile number"                                    |
| 2.7  | Tap "Send OTP" with empty fields               | Nothing happens (button disabled)                  |
| 2.8  | Enter name "A" (1 char)                        | Inline error: "Name must be at least 2 characters" |
| 2.9  | Enter phone "12345" (5 digits starting with 1) | Inline error: "Invalid Indian phone number"        |
| 2.10 | Enter phone "98765" (5 digits only)            | Inline error: "Phone must be 10 digits"            |
| 2.11 | Fix both fields                                | Send OTP button becomes enabled                    |

---

## 3. Register Screen — API Flows

| #   | Step                                                        | Expected                                                                                 |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 3.1 | Enter name "Arjun Sharma", phone "9876543210", tap Send OTP | OTP sent, navigate to Verify screen                                                      |
| 3.2 | Note `debug_otp` shown in banner on Verify screen           | 6-digit code visible                                                                     |
| 3.3 | Go back, re-register same phone                             | Inline error below phone: "Phone number already registered…" (409, no navigation)        |
| 3.4 | Check "Already have an account? Log in" link                | Navigates to Login screen                                                                |
| 3.5 | Check legal text at bottom                                  | "By continuing, you agree to our Terms of Service. No spam. No corporate funding. Ever." |

---

## 4. Login Screen — Field Validation

| #   | Step                               | Expected                                    |
| --- | ---------------------------------- | ------------------------------------------- |
| 4.1 | Navigate to Login from Welcome     | Login screen appears                        |
| 4.2 | Check heading                      | "Welcome back"                              |
| 4.3 | Check sub-text                     | "Enter your phone number to continue"       |
| 4.4 | Check phone label                  | "Mobile number"                             |
| 4.5 | Tap Send OTP with empty phone      | Nothing happens (button disabled)           |
| 4.6 | Enter "5123456789" (starts with 5) | Inline error: "Invalid Indian phone number" |

---

## 5. Login Screen — API Flows

| #   | Step                                                       | Expected                                                                     |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 5.1 | Enter registered phone, tap Send OTP                       | OTP sent, navigate to Verify screen                                          |
| 5.2 | Enter unregistered phone (e.g. "9000099999"), tap Send OTP | Inline error below phone field showing API message "No account found…" (404) |
| 5.3 | On 404 error, tap "New to PrajaShakti? Create account"     | Navigate to Register with phone pre-filled                                   |
| 5.4 | Edit phone after error                                     | Error text clears immediately                                                |

---

## 6. Verify OTP Screen — Text & Layout

| #   | Step                           | Expected                                 |
| --- | ------------------------------ | ---------------------------------------- |
| 6.1 | Arrive at Verify screen        | Screen shows correctly                   |
| 6.2 | Check heading                  | "Enter OTP"                              |
| 6.3 | Check phone display format     | "+91 98765 43210" (space after 5 digits) |
| 6.4 | Check resend timer text        | "Resend OTP in **30s**" (not "0:30")     |
| 6.5 | Dev banner visible in dev mode | Shows 6-digit OTP; tap fills the boxes   |

---

## 7. Verify OTP Screen — Correct OTP

| #   | Step                              | Expected                              |
| --- | --------------------------------- | ------------------------------------- |
| 7.1 | Enter correct 6-digit OTP         | Auto-submits immediately on 6th digit |
| 7.2 | "Verifying…" text appears briefly | Loading state visible                 |
| 7.3 | Success toast shows               | "Welcome to प्रजाशक्ति! 🎉"           |
| 7.4 | App navigates to main feed        | Feed / MainTabs shown                 |
| 7.5 | Close and reopen app              | Session restored, no login required   |

---

## 8. Verify OTP Screen — Wrong OTP

| #   | Step                            | Expected                                                             |
| --- | ------------------------------- | -------------------------------------------------------------------- |
| 8.1 | Enter wrong OTP (e.g. "000000") | Inline red error: "Invalid OTP…" text below boxes                    |
| 8.2 | OTP boxes shake on wrong entry  | Shake animation visible                                              |
| 8.3 | OTP field cleared after error   | Boxes empty, ready for retry                                         |
| 8.4 | Enter wrong OTP 3 times total   | 429 error: "Too many attempts. Please wait 15 minutes." shown inline |

---

## 9. Verify OTP Screen — Resend

| #   | Step                                | Expected                            |
| --- | ----------------------------------- | ----------------------------------- |
| 9.1 | Wait 30 seconds                     | "Resend OTP in Xs" counts down to 0 |
| 9.2 | After countdown: tap "Resend OTP"   | New OTP sent; timer resets to 30s   |
| 9.3 | New debug OTP banner shows new code | Different 6-digit code visible      |
| 9.4 | Old OTP no longer works             | Error on old OTP (expired)          |

---

## 10. Full Round-Trip: Register → Login → Logout

| #    | Step                             | Expected                               |
| ---- | -------------------------------- | -------------------------------------- |
| 10.1 | Register new user (unique phone) | Reaches main feed                      |
| 10.2 | Go to Profile → tap Logout       | Returns to Welcome screen              |
| 10.3 | Tap Login, enter same phone      | OTP sent                               |
| 10.4 | Enter correct OTP                | Reaches main feed again                |
| 10.5 | Kill and reopen app              | Session still active (no login prompt) |

---

## 11. Token Refresh (Background)

| #    | Step                            | Expected                                           |
| ---- | ------------------------------- | -------------------------------------------------- |
| 11.1 | Log in successfully             | In main feed                                       |
| 11.2 | Stop the API server, restart it | API back up                                        |
| 11.3 | Navigate around app             | Authenticated requests succeed (token still valid) |

---

## 12. Error States — Network

| #    | Step                                   | Expected                                                  |
| ---- | -------------------------------------- | --------------------------------------------------------- |
| 12.1 | Turn off WiFi/network, try to register | Error shown: "No internet connection…" inline below phone |
| 12.2 | Restore network, retry                 | Request goes through normally                             |

---

## Cross-Platform Notes

- **Android**: Clipboard OTP auto-fill — when SMS arrives, 6-digit code auto-populates in boxes
- **iOS**: Keyboard avoidance — OTP screen scrolls up correctly when keyboard appears
- **Both**: Back navigation from Verify with partially entered OTP shows confirmation alert "Go back? Your code will be cleared."
