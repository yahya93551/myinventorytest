REVOKE ALL PRIVILEGES ON TABLE
  public.tenant_members,
  public.account_deletion_requests,
  public.data_export_requests,
  public.debts,
  public.inventory_takes,
  public.mfa_attempts,
  public.otp_codes,
  public.user_sessions
FROM PUBLIC, anon, authenticated;
