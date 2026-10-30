CAFE POS v1.2 - Offline Restaurant / Cafe POS (Electron + SQLite)
=================================================================
LOGIN: first time Login ID admin / PIN 1234 -> change it in Staff > Change Login.
Roles: Admin, Manager, Cashier, Waiter, Kitchen, Rider, Cleaner (each can be customised with permission ticks).

NEW IN v1.2
 POS ........ checkout with Paid / Unpaid (khata) / Partial, customer lookup by phone, loyalty discount (2 levels), kitchen notes (not on bill)
 Orders ..... filters (date, type, payment, search), edit order, move table, PDF of any bill
 Kitchen .... New / Preparing / Ready, timers, voice announcement when ready (Settings)
 Delivery ... riders (vehicle, fee), assign -> "On delivery" -> delivered, rider login sees only own deliveries, rider report PDF/CSV
 Customers .. auto-saved from orders, marketing list export; Customer Credit (khata) with ledger and payments
 Inventory .. raw materials with low-stock alerts; Suppliers with purchase/payment ledger (purchase adds stock)
 Payments ... register of who you paid; Expenses with categories
 Menu ....... category colours, deals/combos, item pictures (upload or generate), cost price
 Reports .... revenue, COGS, gross/net profit, margin, product-wise profit, order lines; PDF / Excel(CSV) / JSON export
 Receipt .... Receipt Design screen with live preview (logo, font, paper 58/80/A4, terms, show/hide fields)
 Tables ..... seats, section, status; Cleaner role can only flip table status
 Data reset . Settings > Delete sales data (keeps menu, staff, tables, suppliers; safety copy saved first)

BUILD THE EXE
 GitHub: upload these files into the mintcafe folder (replace old), then Actions > Build Windows EXE > Run workflow.
 Installer name: Cafe POS Setup 1.2.0.exe
Old v1.0/v1.1 data is migrated automatically on first start.
