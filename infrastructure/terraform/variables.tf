variable "aws_region" {
  description = "AWS region for EventBridge and API Destination resources."
  type        = string
  default     = "eu-west-1"
}

variable "name_prefix" {
  description = "Prefix for resource names."
  type        = string
  default     = "abia-weekly-digest"
}

variable "digest_url" {
  description = "Full Amplify URL for the weekly digest cron endpoint (no query string)."
  type        = string
  # Example: https://main.d1234.amplifyapp.com/api/cron/weekly-digest
}

variable "cron_secret" {
  description = "Same CRON_SECRET value configured in the Amplify app environment. Sent as Authorization: Bearer <secret>."
  type        = string
  sensitive   = true
}

variable "schedule_expression" {
  description = <<-EOT
    EventBridge rule schedule (always UTC). Default: every Friday at 07:00 UTC
    (= 08:00 Africa/Lagos / WAT). Example: cron(0 7 ? * FRI *)
  EOT
  type        = string
  default     = "cron(0 7 ? * FRI *)"
}

variable "enabled" {
  description = "Whether the schedule is active."
  type        = bool
  default     = true
}

variable "max_retry_attempts" {
  description = "Retries if the Amplify endpoint fails or times out."
  type        = number
  default     = 2
}
