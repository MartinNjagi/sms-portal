---

# Clarity SMS Dashboard Overwatch (BFF)

### What is this repository for?

* **Summary:** This is the Backend-For-Frontend (BFF) and User Interface layer for the RahaPay Messaging Platform. Built with Node.js, Express, and Nunjucks, it serves as the client-facing dashboard and Admin control panel. It securely interfaces with the core Go Engine to handle high-throughput SMS campaigns, wallet ledger management, and compliance approvals (Sender IDs & Templates).
* **Version:** 1.0.0
* **Architecture:** Traditional Multi-Page Application (MPA) Nunjucks frontend powered by a Node.js Express server, utilizing Axios to proxy requests to the internal Go microservices (Identity, Wallet, SMS) and AWS S3/MinIO for secure bulk CSV handling.

### How do I get set up?

#### Prerequisites

* Node.js (v22.x or higher)
* NPM or Yarn
* Access to the running RahaPay Go Engine backend services.
* Access to the S3/MinIO storage bucket.

#### Configuration

Create a `.env` file in the root directory and configure the following environment variables:

```env
# Server Config
PORT=3000
NODE_ENV=development

# Internal Engine URIs
GO_ENGINE_IDENTITY_URL=http://localhost:4848
GO_ENGINE_WALLET_URL=http://localhost:4849
GO_ENGINE_SMS_URL=http://localhost:4850

# Storage
S3_ENDPOINT=https://s3.your-domain.com
S3_BUCKET_NAME=sms-bucket

```

#### Installation & Execution

1. Clone the repository.
2. Install dependencies:
```bash
npm install

```


3. Start the server (Development):
```bash
npm run dev

```


4. Start the server (Production via PM2 or Systemd):
```bash
npm start

```



#### Core Dependencies

* `express`: Web framework and routing.
* `nunjucks`: Server-side HTML templating.
* `axios`: HTTP client for internal engine communication.
* `helmet`: Security headers and Content Security Policy (CSP) enforcement.
* `multer`: Middleware for handling multipart/form-data.

### Key Features & Project Structure

* **Campaign Management:** UI for single SMS "Quick Sends" and bulk blasts via saved Contact Groups or direct S3 CSV uploads.
* **Real-time Analytics:** Server-Sent Events (SSE) stream live campaign delivery stats directly from the Go Engine to the Nunjucks frontend.
* **Compliance Hub:** Clients can request Sender IDs and customized Templates. Admin endpoints process approvals/rejections.
* **SuperAdmin Controls:** Root administrators (`client_id = 1`) can apply manual wallet adjustments (credits/debits) and override individual tenant SMS billing rates.
* **Anti-Replay Protection:** Internal requests to the Go Engine are secured via HMAC signatures and timestamped micro-offsets to prevent replay attacks during concurrent fetches.

### Contribution guidelines

* **Route Management:** All new routes must be registered within their respective module in `src/modules/` and cleanly exported.
* **Template Naming:** Ensure Nunjucks templates follow the established `.njk` naming convention. Template rendering errors are strictly monitored.
* **Middleware:** Use `requireAuth` for standard dashboard routes and `requireAdmin` for SuperAdmin visibility gates.
* **Code Review:** Submit PRs against the `staging` branch. Ensure no direct hardcoded Go Engine URLs exist in the controllers; use the `clients` wrapper utility.

### Who do I talk to?

* **System Administration / DevOps:** Reach out to the Lead Backend Engineer for infrastructure or Go Engine proxy issues.
