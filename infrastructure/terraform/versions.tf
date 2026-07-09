terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  # Optional: uncomment to store state in S3
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "abia-dashboard/weekly-digest/terraform.tfstate"
  #   region = "eu-west-1"
  # }
}
