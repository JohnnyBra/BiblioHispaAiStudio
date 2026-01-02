from playwright.sync_api import sync_playwright

def verify_prisma_link():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to Login Page
        try:
            page.goto("http://localhost:5173", timeout=30000)
            page.wait_for_load_state("networkidle")

            # 1. Verify Login Page Icon
            print("Verifying Login Page...")
            prisma_link = page.locator("a[href='https://prisma.bibliohispa.es/']")
            if prisma_link.is_visible():
                print("SUCCESS: Link found on Login Page")
                page.screenshot(path="verification/login_page.png")
            else:
                print("FAILURE: Link NOT found on Login Page")

        except Exception as e:
            print(f"Error accessing page: {e}")

        finally:
            browser.close()

if __name__ == "__main__":
    verify_prisma_link()
