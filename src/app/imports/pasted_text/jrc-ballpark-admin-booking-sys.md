Create an **Admin Dashboard and extended User Booking System** for the JRC Ballpark Smart Reservation System based on the existing user interface design.

IMPORTANT:
Both the admin dashboard and the new user-side features must **use the exact same UI design, layout style, colors, typography, spacing, and components as the existing user frontend design**. Do NOT redesign the interface. Reuse the same design system, buttons, cards, tables, and navigation style so the admin panel and new features look like a natural extension of the current system.

The goal is to **extend the existing system with management modules and operational features that solve client concerns** while keeping visual consistency.

LAYOUT

Admin Side:
Keep the same header style used in the user interface but add an **admin sidebar navigation**.

User Side:
Maintain the existing navigation and booking interface used by customers.

ADMIN MODULES

Dashboard Overview
Booking Management
Court & Facility Management
Payment & Transaction Monitoring
User Account Management
Loyalty & Rewards Management
Analytics & Reports
Facility Map Management
Notifications & Announcements
System Settings

ADMIN MODULE BEHAVIOR

Dashboard Overview
Display system statistics based on user platform activity such as:

* Total bookings today
* Active reservations
* Total revenue
* Most popular sport
* Total registered users

Include charts for booking activity, revenue trends, and sports popularity.

Booking Management
Allow admins to manage bookings created from:

* User reservations
* Facility map bookings
* Manual bookings created by admins

Add the following **booking management features**:

Cancellation Management
Users can request cancellation from their booking page.
Admins can review cancellation requests and either approve or reject them.
When approved, the system cancels the booking and automatically frees the time slot.

Reschedule / Rebooking Feature
Admins can edit bookings and move reservations to another available time slot.
The system automatically prevents double booking and updates the schedule.

Manual Booking Feature (For Walk-in or Elderly Customers)
Admins can create reservations manually for customers who cannot use the website.

Manual booking form fields:

* Customer name
* Contact number
* Sport
* Court
* Date
* Time slot

After submission, the system automatically blocks the selected time slot.

Liga Plotting / Bulk Booking Feature
Allow administrators to schedule multiple bookings for leagues or tournaments.

Admins can configure:

* Sport
* Court
* Time slot
* Start date
* End date
* Recurring pattern (example: every Saturday)

The system automatically generates multiple bookings on the calendar.

Booking Status System
Each booking should display a status indicator:

* Pending
* Confirmed
* Cancelled
* Rescheduled
* Completed

These statuses appear in booking tables, calendars, and reports.

Court & Facility Management
Admins can:

* Add courts
* Edit court details
* Set supported sports
* Adjust hourly rates
* Mark courts under maintenance
* Enable or disable courts

Payment & Transaction Monitoring
Display transaction information including:

* Customer name
* Amount paid
* Payment method
* Payment status
* Booking reference

User Account Management
Admins can:

* View user profiles
* Check booking history
* Suspend or reactivate accounts

Loyalty & Rewards Management
Admins can configure and monitor loyalty programs.

Features include:

* Create reward rules (example: book 5 sessions get 1 discounted booking)
* Track loyalty progress
* Monitor redeemed rewards

Analytics & Reports
Display charts and analytics including:

* Monthly revenue
* Peak booking hours
* Most popular sports
* Court usage rate

Facility Map Management
Admins can control the interactive facility map used by users:

* Edit court labels
* Toggle availability
* Update court positions
* Enable or disable courts

Notifications & Announcements
Admins can send announcements to users such as:

* Promotions
* Maintenance notices
* Booking reminders
* System updates

System Settings
Allow configuration of:

* Business operating hours
* Booking duration limits
* Downpayment percentage
* Cancellation policies
* Booking rules

USER SIDE BOOKING FEATURES

Extend the user booking system with the following features:

My Bookings Page
Create a page where users can view all their reservations including:

* Booking date
* Sport
* Court
* Time slot
* Booking status

Cancellation Request Feature
Allow users to request cancellation of their booking.

User Flow:

1. User opens **My Bookings**
2. User selects a reservation
3. User clicks **Request Cancellation**
4. The system sends a cancellation request to the admin dashboard

Admins will review and approve or reject the request.

Reschedule / Rebooking Feature
Allow users to change their reservation schedule.

User Flow:

1. User opens **My Bookings**
2. User selects a booking
3. User clicks **Reschedule Booking**
4. The system displays available time slots
5. The user selects a new schedule

The system automatically updates the booking and prevents double booking conflicts.

Design Requirements

* Use the same UI style as the existing frontend
* Reuse the same cards, buttons, forms, and tables
* Maintain visual consistency between user frontend and admin dashboard
* The new features should look like natural extensions of the current booking system
