# Supabase Configuration for Password Reset

## Required Supabase Dashboard Settings

### 1. Authentication → Settings
- **Enable Magic Link**: ✅ ON
- **Site URL**: `https://diestats.app`
- **Redirect URLs** (add all of these):
  ```
  https://diestats.app/auth/callback
  https://diestats.app/auth/reset-password
  ```

### 2. Authentication → Email Templates
- **Magic Link Template**: ✅ Enabled
- **Password Reset Template**: ✅ Enabled

### 3. Settings → Integrations
- **Resend**: ✅ Connected and configured
- **Domain**: `diestats.app` verified in Resend

## Email Template Configuration

### Password Reset Email Template
Make sure your password reset email template includes:
```html
<h2>Reset your password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

### Magic Link Email Template
Make sure your magic link email template includes:
```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

## Testing Checklist

### ✅ Local Development
- [ ] Magic link signup works
- [ ] Magic link signin works
- [ ] Password reset email sends
- [ ] Password reset link works
- [ ] New password can be set

### ✅ Production (diestats.app)
- [ ] All redirect URLs configured
- [ ] Resend integration working
- [ ] Email templates configured
- [ ] Domain verified in Resend
- [ ] SSL certificate valid

## Common Issues

### Issue: "Invalid redirect URL"
**Solution**: Add the exact URL to Supabase redirect URLs list

### Issue: "Email not sent"
**Solution**: Check Resend integration and domain verification

### Issue: "Session expired"
**Solution**: Password reset links expire in 1 hour by default

### Issue: "User not found"
**Solution**: Make sure the email exists in your auth.users table
