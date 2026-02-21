#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build Outlet Configuration and Supplier Detail screens for the FinSight AI financial intelligence platform.
  - Outlet Configuration: country mode (India vs international), local currency, timezone, required report types
  - Supplier profiles: GST/tax ID validation, duplicate detection, fuzzy name warnings, spend metrics
  - Design both screens to be low-literacy friendly with strong validation and clean mobile UX
  - Verify outlet-level data isolation, document_date consistency, currency per outlet, supplier auto-matching

backend:
  - task: "Outlet Configuration API - GET /api/outlets/{id}/config"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Implemented full outlet config endpoint with country mode, timezone, currency, GST settings, required reports, business hours, and stats"

  - task: "Outlet Configuration API - PUT /api/outlets/{id}/config"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Implemented update endpoint with country mode auto-configuration for India vs international"

  - task: "Supplier Detail API - GET /api/suppliers/{id}"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Returns supplier profile with total_spend, document_count, avg_invoice, monthly_trend"

  - task: "GST Validation API - POST /api/suppliers/validate-gst"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Validates Indian GST format (27AABCU9603R1ZM), UAE TRN, Singapore GST. Returns existing_supplier if duplicate found"

  - task: "Supplier Duplicate Check API - POST /api/suppliers/check-duplicate"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Fuzzy name matching with Jaccard similarity. Returns potential duplicates with similarity percentage"

  - task: "Enhanced Supplier Create/Update APIs"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "POST/PUT /api/suppliers now includes GST validation, duplicate detection warnings, category management"

frontend:
  - task: "Outlet Configuration Screen"
    implemented: true
    working: "needs_testing"
    file: "app/outlet-config.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "needs_testing"
        agent: "main"
        comment: "Full screen with country mode toggle (India/International), currency selector, timezone picker, GST toggle & rate, required reports checkboxes, business hours inputs, stats summary"

  - task: "Supplier Detail Screen"
    implemented: true
    working: "needs_testing"
    file: "app/supplier-detail.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "needs_testing"
        agent: "main"
        comment: "Full supplier profile card, stats row, monthly trend chart, document list with pagination, edit modal with GST validation and duplicate warning"

  - task: "Settings Outlet Navigation"
    implemented: true
    working: "needs_testing"
    file: "app/(tabs)/settings.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "needs_testing"
        agent: "main"
        comment: "Outlet rows now navigate to outlet-config for owners, calendar for others. Shows settings icon and currency"

  - task: "Dashboard Supplier Hub Link"
    implemented: true
    working: "needs_testing"
    file: "app/(tabs)/dashboard.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "needs_testing"
        agent: "main"
        comment: "Added Supplier Hub button to quick actions row on owner dashboard"

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Outlet Configuration Screen"
    - "Supplier Detail Screen"
    - "GST Validation"
    - "Duplicate Detection"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Phase 4 implementation complete. Added:
      1. Outlet Configuration screen with country mode, currency, timezone, GST, required reports
      2. Supplier Detail screen with profile, stats, trend chart, document list, edit modal
      3. GST/Tax ID validation (Indian GSTIN format, UAE TRN, Singapore GST)
      4. Supplier duplicate detection with fuzzy name matching
      5. Navigation from Settings -> Outlet Config (for owners)
      6. Navigation from Dashboard -> Supplier Hub
      
      Backend APIs tested manually via curl - all working.
      Frontend screens need UI testing.
      
      Test credentials: owner@spicekitchen.com / demo123
  
  - agent: "testing"
    message: |
      Comprehensive backend API testing completed for Phase 4 FinSight APIs:
      
      ✅ CORE API TESTS (9/9 PASSED):
      1. Outlet Configuration GET - Returns full config with country_mode, timezone, currency, GST settings, required reports, business hours, and stats
      2. Outlet Configuration PUT - Successfully updates config with auto-defaults (India→International mode switching working)
      3. Suppliers List GET - Returns suppliers with spend metrics (total_spend, document_count, avg_invoice)
      4. Supplier Detail GET - Returns profile with monthly_trend data structure
      5. Supplier Documents GET - Returns paginated document list by supplier
      6. GST Validation POST - Validates Indian GST format (27AABCU9603R1ZM), rejects invalid formats, detects existing suppliers
      7. Duplicate Check POST - Fuzzy name matching working with similarity percentages (found "Metro Cash & Carry" with 75% match for "Metro Cash Carry")
      8. Supplier Create POST - Creates suppliers with GST validation, duplicate warnings, and proper validation responses
      9. Supplier Update PUT - Updates suppliers with validation and duplicate warnings
      
      ✅ KEY VERIFICATION POINTS (5/5 PASSED):
      1. Document queries use document_date (not upload_date) - Verified date filtering works correctly
      2. Currency per outlet correctly applied - Tested currency updates and auto-defaults
      3. Organization isolation working - Supplier queries properly filtered by org_id
      4. GST validation follows Indian format rules - State codes 01-38 validated, proper format checking, user-friendly lowercase auto-formatting
      5. Fuzzy matching with threshold - Jaccard similarity algorithm working with proper percentage scores
      
      All backend APIs are fully functional and meet the specified requirements. No critical issues found.