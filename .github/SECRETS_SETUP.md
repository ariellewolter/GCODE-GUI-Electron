# GitHub secrets for macOS build & release

These secrets let GitHub Actions **sign** and **notarize** your Mac app when you push a version tag (like `v1.2.0`).

You need the **same five values** you (or someone) already added to the old repo `GCODE_GUI`.  
GitHub does **not** show secret values again after you save them — you have to look them up where you originally stored them.

---

## Step 1 — Create your local secrets file

In Terminal, from the project folder:

```bash
cp .github/secrets.env.example .github/secrets.env
open -e .github/secrets.env
```

That opens a text file with five lines to fill in. **Do not commit `secrets.env`** (it is gitignored).

---

## Step 2 — Fill in each line (what to type)

### `APPLE_ID`

**What it is:** The email address you use to sign in to Apple / App Store Connect.

**What to put:** Your Apple ID email, for example:

```text
APPLE_ID=you@example.com
```

**Where to find it:** The email you use at [https://appleid.apple.com](https://appleid.apple.com) or on your Mac in **System Settings → Apple Account**.

---

### `APPLE_APP_SPECIFIC_PASSWORD`

**What it is:** A special one-time password Apple gives you for tools (not your normal Apple ID password).

**What to put:** A string Apple shows you once, usually like `abcd-efgh-ijkl-mnop` (with dashes):

```text
APPLE_APP_SPECIFIC_PASSWORD=abcd-efgh-ijkl-mnop
```

**Where to get it:**

1. Go to [https://appleid.apple.com](https://appleid.apple.com) and sign in.
2. Open **Sign-In and Security** (or **App-Specific Passwords**).
3. Click **Generate an app-specific password** (or use an existing one you saved for “GitHub” or “notarytool”).
4. Copy that password into `secrets.env`.

If you already created one for the original `GCODE_GUI` repo, use **that same password** from your password manager — you cannot view it again on Apple’s site.

---

### `APPLE_TEAM_ID`

**What it is:** A 10-character code for your Apple Developer team.

**What to put:** For this project the workflow already uses team **`74MA96HS7Z`**:

```text
APPLE_TEAM_ID=74MA96HS7Z
```

**Where to find it:**

- [https://developer.apple.com/account](https://developer.apple.com/account) → **Membership details** → **Team ID**, or  
- Xcode → **Settings → Accounts** → select your team → **Team ID**.

---

### `MACOS_CERT_P12_PATH`

**What it is:** The **full path on your Mac** to your code-signing certificate file (a `.p12` or `.pfx` file).

**What to put:** An absolute path in quotes if it has spaces:

```text
MACOS_CERT_P12_PATH=/Users/yourname/certs/DeveloperID.p12
```

**Where to find the file:**

- Wherever you saved it when you exported **Developer ID Application** from Keychain Access, or  
- From whoever set up signing for `GCODE_GUI` originally.

**How to export from Keychain (if you only have the cert in Keychain):**

1. Open **Keychain Access** on your Mac.
2. Select **login** keychain, category **My Certificates**.
3. Find **Developer ID Application: Arielle Wolter (74MA96HS7Z)** (or your name).
4. Right-click the certificate → **Export** → save as `.p12`.
5. Set an export password — that becomes `MACOS_CERT_PASSWORD` below.
6. Put the full path to that file in `MACOS_CERT_P12_PATH`.

**Tip:** Drag the `.p12` file into Terminal to paste its path.

---

### `MACOS_CERT_PASSWORD`

**What it is:** The password you chose when you **exported** the `.p12` file (not your Mac login, not your Apple ID).

**What to put:**

```text
MACOS_CERT_PASSWORD=the-password-you-set-when-exporting-p12
```

**Where to find it:** Only in your memory / password manager from when the `.p12` was created. Apple and GitHub cannot show it again.

---

## Step 3 — Example of a completed `secrets.env`

```text
APPLE_ID=ariellewolter@example.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=74MA96HS7Z
MACOS_CERT_PASSWORD=MyP12ExportPassword123
MACOS_CERT_P12_PATH=/Users/ariellewolter/Documents/certs/DeveloperID.p12
```

Use **your** real values — this is only an example shape.

---

## Step 4 — Upload secrets to GitHub

```bash
./scripts/setup-github-secrets.sh
```

That sends all five secrets to **GCODE-GUI-Electron**.

To update the original repo instead:

```bash
./scripts/setup-github-secrets.sh ariellewolter/GCODE_GUI
```

Check they exist:

```bash
gh secret list -R ariellewolter/GCODE-GUI-Electron
```

You should see five secret **names** (not the values).

---

## If you don’t have the old values

| Secret | What to do |
|--------|------------|
| Apple ID email | Use your normal Apple account email |
| App-specific password | Generate a new one at appleid.apple.com |
| Team ID | Use `74MA96HS7Z` (already in the workflow) |
| `.p12` file + password | Export again from Keychain (see above) or ask whoever set up `GCODE_GUI` |

---

## What triggers a release?

Pushing a git tag like `v2.0.0` runs `.github/workflows/release-macos.yml`.

That workflow today builds the **Python/PyInstaller** app, not the Electron app. Electron releases would need a separate workflow later.
