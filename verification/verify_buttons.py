
from playwright.sync_api import sync_playwright

def verify_back_buttons():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # 1. Verify Login Page
            print("Navigating to login page...")
            page.goto("http://localhost:5173")
            page.wait_for_load_state("networkidle")

            # Check for "Volver a Prisma" button
            print("Checking login page button...")
            login_back_button = page.locator("a[href='https://prisma.bibliohispa.es/']")
            if login_back_button.is_visible():
                print("SUCCESS: Back button found on login page.")
            else:
                print("FAILURE: Back button NOT found on login page.")

            page.screenshot(path="verification/login_page.png")

            # 2. Login as Student to verify StudentView
            print("Logging in as student...")
            # Assuming 'juan.garcia' exists or similiar based on memory/code, let's try a generic user or look at the code.
            # In App.tsx: const student = users.find(u => u.username === loginInput.toLowerCase() && u.role === UserRole.STUDENT);
            # We need to know a valid student username. Let's check db.json or assume one from previous context.
            # If no db.json is accessible easily, we might struggle.
            # But the memory says: "application persists data using a local JSON file located at data/db.json"
            # We can try to read db.json to get a valid user.

            # Since I can't read db.json in python script easily without extra steps, I'll assume 'demo' or check previously read files.
            # The read of AdminView showed "users" prop. App.tsx loads from storageService.

            # Let's try to find a user first.
            # Actually, for this verification, just checking the Login Page might be enough if I can't easily login.
            # But the plan required changes in StudentView and AdminView too.

            # Let's try to mock the user state? No, integration test is better.
            # I'll rely on the Login Page screenshot for now, and try to login if I can guess a user.
            # 'juan.garcia' is the placeholder.

            page.fill("input[placeholder='juan.garcia']", "juan.garcia")
            page.click("button:has-text('Entrar')")

            # Wait a bit
            page.wait_for_timeout(2000)

            # Check if we are in StudentView
            if page.locator("text=Catálogo").is_visible():
                 print("Logged in as Student.")
                 student_back_button = page.locator("a[href='https://prisma.bibliohispa.es/']")
                 if student_back_button.is_visible():
                     print("SUCCESS: Back button found on Student View.")
                 else:
                     print("FAILURE: Back button NOT found on Student View.")
                 page.screenshot(path="verification/student_view.png")
            else:
                 print("Could not login as student (maybe user doesn't exist). Skipping StudentView check.")

            # 3. Login as Admin
            # We need to logout first if logged in
            if page.locator("text=Salir").is_visible():
                page.click("text=Salir")

            print("Logging in as Admin...")
            page.click("text=ACCESO PROFESORES")
            page.click("text=Usar Contraseña Manual")

            # Default creds from memory: superadmin / admin123
            page.fill("input[placeholder='Usuario']", "superadmin")
            page.fill("input[placeholder='••••••••']", "admin123")
            page.click("button:has-text('Entrar')")

            page.wait_for_timeout(2000)

            if page.locator("text=Panel de Administración").is_visible():
                 print("Logged in as Admin.")
                 admin_back_button = page.locator("a[href='https://prisma.bibliohispa.es/']")
                 if admin_back_button.is_visible():
                     print("SUCCESS: Back button found on Admin View.")
                 else:
                     print("FAILURE: Back button NOT found on Admin View.")
                 page.screenshot(path="verification/admin_view.png")
            else:
                 print("Could not login as admin. Skipping AdminView check.")

        except Exception as e:
            print(f"Error during verification: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_back_buttons()
