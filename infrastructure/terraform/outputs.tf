output "rule_name" {
  description = "EventBridge rule name."
  value       = aws_cloudwatch_event_rule.weekly_digest.name
}

output "rule_arn" {
  description = "EventBridge rule ARN."
  value       = aws_cloudwatch_event_rule.weekly_digest.arn
}

output "api_destination_arn" {
  description = "API Destination ARN (Amplify HTTP target)."
  value       = aws_cloudwatch_event_api_destination.digest.arn
}

output "digest_url" {
  description = "Configured Amplify cron URL."
  value       = var.digest_url
}

output "schedule_expression" {
  description = "Cron expression in use (UTC)."
  value       = var.schedule_expression
}
