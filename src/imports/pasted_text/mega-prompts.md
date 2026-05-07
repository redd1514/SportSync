Here are your final, fully engineered Mega-Prompts.

I have specifically designed these to accomplish three things for your Capstone defense:

Fix the UI/UX: We are using the consolidated tab structure so it looks like a high-end SaaS product, not a confusing 20-tab mess.

Brand Accuracy: I explicitly included your specific brand elements (the orange-to-blue gradient text, the vertical image slices, the dark mode aesthetics).

Code Export Readiness (VS Code): I added strict commands telling the AI to use "Auto Layout" and "Component-based architecture." This is critical. When you export these designs to Visual Studio Code (using plugins like Locofy or Anima to get React code), Auto Layout translates perfectly into CSS Flexbox. If you don't use Auto Layout, your exported code will be absolute garbage.

Copy and paste these directly into Figma Make.

🚀 PROMPT 1: The Customer Portal (Auth, Booking & Map)
Copy & Paste this:

"Design a premium Customer UI Kit for a Progressive Web App named 'JRC SportSync'. CRITICAL: Use strict Auto Layout (Flexbox) and component-based structure for React code export. Include a Light/Dark Mode toggle. Theme: Deep Dark Mode (Charcoal background, vibrant Orange primary buttons, Royal Blue accents).
Screen 1 (Home & Auth): Top Nav: Logo, 'Book Courts', 'My Activity', Theme Toggle, 'Sign In' (blue outline), and 'Create Account' (solid orange). Hero Section: Main heading 'Where Every Game & Event Comes to Life' using a text gradient from Orange to Blue. Below it, a row of vertical image slices showing different sports with pill-shaped labels. Add a '2026 Rental Rates' section using glassmorphism cards. Include two floating modal designs for 'Sign In' and 'Register'.
Screen 2 (Map & Booking Engine): A split-screen layout. Left side: An interactive 2D floor plan of courts with a 'Time Slider' (7 AM - 12 MN). Show glowing Green 'Available' and Red 'Occupied' court badges. Right side: A booking step-panel (Sport -> Date/Time -> Add-ons like Aircon P1500/Scoreboard P300 -> 'Pay via GCash' total summary card).
Screen 3 (Activity & Coaching): A unified dashboard. Top half: Browse Coach Profiles with hourly rates. Bottom half: 'My Bookings' list (past/upcoming). Bottom right corner: A floating AI Chatbot FAB (Floating Action Button) titled 'JRC AI Concierge'.
Animations: Add subtle glowing orange hover states to all buttons. Design the chat panel to look like it slides in smoothly from the right."

👔 PROMPT 2: The Facility Staff Portal (Front-Desk Operations)
Copy & Paste this:

"Design a Facility Staff Operations UI Kit for a sports complex web app. CRITICAL: Use strict Auto Layout for responsive iPad/Desktop developer export. Theme: Clean Light Mode (White backgrounds, light gray panels, high-contrast dark text, Orange and Blue accents).
Screen 1 (Live Operations): A left sidebar navigation (Live Ops, Calendar, Inbox). Main view: A quick-glance 'Live 2D Map' showing currently active courts. Above the map, 3 modern metric cards: 'Today's Revenue', 'Active Courts', and 'Checked-In Users'. Include a prominent 'New Walk-In' floating action button.
Screen 2 (Master Calendar): A large, detailed weekly calendar grid view spanning the screen. Show color-coded time blocks for 'Online Bookings' (Blue) and manual 'Walk-in/Liga' bookings (Orange). Include a slide-out right-side panel titled 'Encode Walk-in', containing input fields for Customer Name, Sport, Court, Time, and a 'Cash Payment Received' toggle switch.
Screen 3 (Front-Desk Inbox): A task-management layout acting as an inbox. A split list showing 'Pending Coaching Requests' (with Approve/Decline buttons) and 'Equipment Rentals' (showing items with a 'Mark as Returned' button).
Animations: Include hover states for calendar blocks and smooth slide-out transition states for the walk-in panel."

👑 PROMPT 3: The System Admin Command Center
Copy & Paste this:

"Design an Executive Admin Dashboard UI Kit for a sports business. CRITICAL: Use strict Auto Layout for React UI component export. Theme: Modern SaaS Light Mode (Crisp whites, sleek borders, data-heavy layout with Orange and Blue brand colors).
Screen 1 (Executive Overview): Sidebar navigation (Dashboard, Facility Builder, Calendar, Settings). Main screen: Advanced data visualization. A line graph showing 'Weekly Revenue Trends', a bar chart for 'Popular Sports', and a data table logging recent 'Automated Webhook Payments' with timestamps and green 'Success' badges.
Screen 2 (Facility Map Builder): A drag-and-drop layout tool. The center is a large dotted-grid canvas representing the facility floor plan. On the right side, a 'Court Palette' showing draggable shapes (Basketball Court, Half Court, Billiard Table). Show one court actively being dragged with a blue selection border, drop-shadow, and alignment snapping lines.
Screen 3 (System Settings): A master configuration page with horizontal tabs. Tab 1: 'Business Rules' (inputs for operating hours). Tab 2: 'AI Knowledge Base' (a large text-area box where admins paste rules for the AI). Tab 3: 'Add-on Pricing' (editable list for equipment rental prices).
Animations: Show active/inactive states for the horizontal tabs and a clear 'drag-and-drop' visual state for the map builder. The interface must look highly technical, structured, and premium."