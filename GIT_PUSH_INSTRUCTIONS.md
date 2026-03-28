# 🚀 Git Push Instructions for LegalHub

Your local code is ready. The error "Repository not found" implies you are logged in as a different GitHub user (or not logged in).

## 🔑 Crucial Step: Authentication

**Setting `user.email` in git config does NOT log you in.** It only puts your name on the commits. You must actively sign in to GitHub to push code.

### Option A: Force New Login (Recommended)
Run this command in your terminal to clear old credentials and trigger a new login:

```powershell
# Windows Command to clear saved GitHub credentials
cmdkey /delete:git:https://github.com
```

Then try pushing again:
```bash
git push -u origin main
```
A window should pop up. **Sign in with `digitalmeng26-ai`**.

---

### Option B: Use a Personal Access Token (If popup fails)

1.  Go to **GitHub Settings** -> **Developer Settings** -> **Personal Access Tokens (Tokens (classic))**.
2.  Generate a new token with `repo` permissions.
3.  Copy the token (starts with `ghp_`).
4.  In the terminal, run:
    ```bash
    git remote set-url origin https://digitalmeng26-ai:YOUR_TOKEN_HERE@github.com/digitalmeng26-ai/Legalhub.git
    git push -u origin main
    ```
    *(Replace `YOUR_TOKEN_HERE` with the actual token)*

## Repository Details
- **Repo URL:** `https://github.com/digitalmeng26-ai/Legalhub.git`
- **Username:** `digitalmeng26-ai`

## Basic Setup Commands (Review)
If you haven't run these yet:
```bash
git remote add origin https://github.com/digitalmeng26-ai/Legalhub.git
git branch -M main
```
