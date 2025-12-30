
from playwright.sync_api import sync_playwright

def verify_login_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:5173")
            page.wait_for_selector("text=ACCESO PROFESORES")
            page.click("text=ACCESO PROFESORES")

            # Wait for the view to update
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/teacher_login.png")
            print("Screenshot taken")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_login_page()
