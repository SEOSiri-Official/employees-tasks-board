# Employees Tasks Board (`employees-tasks-board`)

> 📊 **Live Web Board:** [board.seosiri.com](https://board.seosiri.com)  
> 🌐 **Backend Edge Gateway:** [tasks.seosiri.com](https://tasks.seosiri.com)  
> 📖 **Developer Documentation:** [developers.seosiri.com](https://developers.seosiri.com)  
> 🛡️ **Corporate Gateway:** [seosiri.com](https://seosiri.com)

The enterprise web command center and visual 4-column Kanban pipeline for the **SEOSiri Task Sentinel** ecosystem. Built with React 18, TypeScript, and Tailwind CSS, deployed on Cloudflare Pages.

---

## 🏛️ Features & Architecture

- **4-Column Workflow Pipeline:**
  - `Urgent Tasks Assigning` (Priority queue with auto-ping alerts)
  - `Task Progress` (In-flight execution with telemetry logging)
  - `Pending Review` (Blocked items with manager escalation)
  - `Finished Task` (Completed items with cycle-time tracking)
- **Role-Based Data Isolation:**
  - **Admin View:** Global oversight across all company departments and velocity digests.
  - **Employee View:** Zero-trust isolation—users only see their assigned tasks (`ETMAGJUMR62`).
- **Triple Ingestion Stream:** Supports single task injection, bulk CSV/spreadsheet import, and real-time Jira webhooks.
- **Real-Time Notification Pings:** Interactive alert drawer for deadline pings and blocker notices.
- **SME Freemium Seat Tracker:** Displays live seat allocation (`Seats: X / 10`) with license token activation.

---

## 🛠️ Local Development & Deployment

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Build production bundle
npm run build

# 4. Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=employees-tasks-board --branch=main --commit-dirty=true
```

## 📄 License

Distributed under the MIT License https://github.com/SEOSiri-Official/employees-tasks-board/blob/main/LICENSE.

Maintained by Momenul Ahmad under SEOSiri .
