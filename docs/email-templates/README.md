# Supabase auth email templates

The two emails Supabase Auth sends for this app, in the Luna Group look Trent
approved on 22 Oct 2026. They can't be set from code. Paste them into the
Supabase dashboard for the guest list project (`fiquraregaucwnrjhwqx`): open
**Authentication**, then the email templates.

| File | Template | Subject |
| --- | --- | --- |
| `confirm-signup.html` | Confirm signup | Confirm your email for Luna Group |
| `reset-password.html` | Reset password | Reset your Luna Group password |

- Both use `{{ .ConfirmationURL }}`, the same link the current templates send.
  The sign-in flow is unchanged.
- There's no first name: sign-up doesn't store one, so the headline is
  "Confirm your email".
- Images load from `https://promoter.lunagroup.com.au`, so they work once that
  site is live with this branch.
- They're built from `src/lib/email/blocks.ts`. If the blocks change, rebuild
  these from them rather than hand-editing.
