# Lets GitHub Actions add/remove PR preview hostnames in Firebase Auth's
# authorized domains, via Workload Identity Federation (no stored keys).

locals {
  firebase_project_id     = "hundred-and-ten"
  firebase_project_number = "588284365953"
}

provider "google" {
  project = local.firebase_project_id
}

resource "google_project_service" "apis" {
  for_each = toset([
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "identitytoolkit.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

resource "google_service_account" "firebase_domains" {
  account_id   = "gh-preview-auth-domains"
  display_name = "GitHub Actions: manage Firebase authorized domains"

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "firebase_domains_auth_admin" {
  project = local.firebase_project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.firebase_domains.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == \"seamuslowry/hundred-and-ten-web\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_impersonation" {
  service_account_id = google_service_account.firebase_domains.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${local.firebase_project_number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/attribute.repository/seamuslowry/hundred-and-ten-web"
}

resource "github_actions_variable" "gcp_workload_identity_provider" {
  repository    = "hundred-and-ten-web"
  variable_name = "GCP_WORKLOAD_IDENTITY_PROVIDER"
  value         = google_iam_workload_identity_pool_provider.github.name
}

resource "github_actions_variable" "gcp_service_account" {
  repository    = "hundred-and-ten-web"
  variable_name = "GCP_SERVICE_ACCOUNT"
  value         = google_service_account.firebase_domains.email
}

resource "github_actions_variable" "firebase_project_id" {
  repository    = "hundred-and-ten-web"
  variable_name = "FIREBASE_PROJECT_ID"
  value         = local.firebase_project_id
}
