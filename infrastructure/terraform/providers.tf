provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "abia-dashboard"
      Component = "weekly-digest-scheduler"
      ManagedBy = "terraform"
    }
  }
}
