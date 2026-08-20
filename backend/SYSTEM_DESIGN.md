# System Design — Society Maintenance Tracker

## 1. Complaint History Model

The Society Maintenance Tracker uses a structured complaint lifecycle to ensure that every maintenance request can be tracked from creation to resolution. Each complaint is stored with a resident ID, category, description, optional photo path, status, priority, creation timestamp, and resolution timestamp.

A complaint can have three statuses: **Open**, **In Progress**, and **Resolved**. When a resident creates a complaint, it is initially assigned the Open status and Medium priority.

A separate `complaint_history` table is used to preserve the complete history of every complaint. Each history record contains the complaint ID, status, actor ID, optional note, and timestamp. Whenever an administrator changes the complaint status or adds an update note, a new history record is created. This provides an auditable record showing what changed, who made the change, and when it happened.

Once a complaint reaches the Resolved status, it is considered closed and its overdue flag is cleared.

## 2. Overdue Detection

Overdue detection is implemented using a configurable threshold rather than a fixed value. The threshold is controlled through the `OVERDUE_DAYS` environment variable, which is set to 7 days by default.

When complaints are requested by the system, unresolved complaints are checked against their creation time. If the age of an unresolved complaint is equal to or greater than the configured threshold, its `is_overdue` flag is set.

Overdue complaints are given higher visibility in the administrator interface. They are displayed at the top of the complaint list and are also included in the dashboard's overdue complaint count.

When an administrator resolves a complaint, its overdue flag is automatically cleared. This ensures that the dashboard reflects the current state of active overdue complaints.

## 3. Photo Handling

Residents can optionally attach a photograph while submitting a complaint. The frontend sends the complaint information and image using a multipart form request.

The backend uses Multer to process uploaded images. Only supported image formats such as JPG, JPEG, PNG, and WEBP are accepted, and uploads are limited to 5 MB.

Uploaded images are stored in the backend `uploads` directory. The resulting file path is stored with the complaint record in the database. When a resident or administrator views complaint details, the stored image path is used to display the uploaded photograph.

This approach keeps complaint information and its supporting evidence connected while preventing unsupported file types and excessively large uploads.

## 4. Notification Flow

The application uses Nodemailer with Gmail SMTP to provide email notifications.

When an administrator changes a complaint's status, the backend identifies the resident associated with that complaint and sends an email notification to the resident's registered email address. The notification informs the resident of the new complaint status.

The same notification mechanism is used when an administrator creates an important notice. Important notices are marked using the `important` flag and are displayed prominently on the notice board. An email is sent to registered residents informing them about the important society notice.

SMTP credentials are stored in environment variables rather than directly in source code. The actual `.env` file is excluded from source control, while `.env.example` documents the required configuration fields.

## Conclusion

The system combines role-based authentication, structured complaint lifecycle management, historical tracking, configurable overdue detection, secure photo handling, notice management, dashboard reporting, and email notifications. This provides residents with visibility into their complaints while giving administrators the tools required to manage and monitor maintenance activities efficiently.
