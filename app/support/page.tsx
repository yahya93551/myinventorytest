export const metadata = {
  title: 'Support Center | My Inventory',
  description: 'Get help and support for My Inventory',
};

import SalesRouteGuard from "@/components/SalesRouteGuard";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white">
      <SalesRouteGuard />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-2 text-theme-primary">Support Center</h1>
        <p className="text-theme-secondary mb-12">We're here to help. Get in touch with us.</p>

        <div className="grid gap-8 md:grid-cols-2 mb-12">
          {/* Email Support */}
          <div className="p-6 border-2 border-theme-input rounded-xl hover:border-theme-primary transition">
            <div className="text-3xl mb-3">📧</div>
            <h3 className="text-xl font-bold text-theme-primary mb-2">Email Support</h3>
            <p className="text-theme-secondary mb-2">support@yourdomain.com</p>
            <p className="text-sm text-gray-500">Response time: 24-48 hours</p>
          </div>

          {/* WhatsApp Support */}
          <div className="p-6 border-2 border-theme-input rounded-xl hover:border-theme-primary transition">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="text-xl font-bold text-theme-primary mb-2">WhatsApp Chat</h3>
            <a
              href="https://wa.me/252686859656"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-600 hover:text-cyan-700 font-semibold"
            >
              +252686859656
            </a>
            <p className="text-sm text-gray-500 mt-2">Available: 9 AM - 5 PM GMT+3</p>
          </div>

          {/* Phone Support */}
          <div className="p-6 border-2 border-theme-input rounded-xl hover:border-theme-primary transition">
            <div className="text-3xl mb-3">📞</div>
            <h3 className="text-xl font-bold text-theme-primary mb-2">Phone Support</h3>
            <p className="text-theme-secondary mb-2">+252686859656</p>
            <p className="text-sm text-gray-500">Available: 9 AM - 5 PM GMT+3</p>
          </div>

          {/* Quick Help */}
          <div className="p-6 border-2 border-theme-input rounded-xl hover:border-theme-primary transition">
            <div className="text-3xl mb-3">❓</div>
            <h3 className="text-xl font-bold text-theme-primary mb-2">FAQ</h3>
            <a
              href="#faq"
              className="text-cyan-600 hover:text-cyan-700 font-semibold"
            >
              View Common Questions
            </a>
            <p className="text-sm text-gray-500 mt-2">Quick answers to popular topics</p>
          </div>
        </div>

        {/* FAQ Section */}
        <section id="faq" className="mt-16">
          <h2 className="text-3xl font-bold text-theme-primary mb-8">Frequently Asked Questions</h2>

          <div className="space-y-4">
            {/* FAQ Item 1 */}
            <details className="group p-4 border-2 border-theme-input rounded-lg hover:border-theme-primary transition cursor-pointer">
              <summary className="font-semibold text-theme-primary flex items-center justify-between">
                <span>How do I cancel my subscription?</span>
                <span className="group-open:rotate-180 transition">▼</span>
              </summary>
              <p className="text-theme-secondary mt-4 ml-0">
                Go to <strong>Settings → Subscription</strong> and click "Cancel Subscription". Your access
                will continue until the end of your billing period.
              </p>
            </details>

            {/* FAQ Item 2 */}
            <details className="group p-4 border-2 border-theme-input rounded-lg hover:border-theme-primary transition cursor-pointer">
              <summary className="font-semibold text-theme-primary flex items-center justify-between">
                <span>Can I export my data?</span>
                <span className="group-open:rotate-180 transition">▼</span>
              </summary>
              <p className="text-theme-secondary mt-4 ml-0">
                Yes! Go to <strong>Settings → Account → Export My Data</strong> to download your inventory
                and sales records in CSV format.
              </p>
            </details>

            {/* FAQ Item 3 */}
            <details className="group p-4 border-2 border-theme-input rounded-lg hover:border-theme-primary transition cursor-pointer">
              <summary className="font-semibold text-theme-primary flex items-center justify-between">
                <span>Is my data secure?</span>
                <span className="group-open:rotate-180 transition">▼</span>
              </summary>
              <div className="text-theme-secondary mt-4 ml-0">
                <p className="mb-2">Yes! We use enterprise-grade security:</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                  <li>Encryption for data in transit and at rest</li>
                  <li>Two-factor authentication (2FA) support</li>
                  <li>Complete audit logging of all actions</li>
                  <li>GDPR and privacy law compliance</li>
                  <li>Regular security audits</li>
                </ul>
              </div>
            </details>

            {/* FAQ Item 4 */}
            <details className="group p-4 border-2 border-theme-input rounded-lg hover:border-theme-primary transition cursor-pointer">
              <summary className="font-semibold text-theme-primary flex items-center justify-between">
                <span>How do I add team members?</span>
                <span className="group-open:rotate-180 transition">▼</span>
              </summary>
              <p className="text-theme-secondary mt-4 ml-0">
                Go to <strong>Settings → Team Members</strong> and click "Invite New Member". You can assign
                different roles: Owner, Accountant, or Sales.
              </p>
            </details>

            {/* FAQ Item 5 */}
            <details className="group p-4 border-2 border-theme-input rounded-lg hover:border-theme-primary transition cursor-pointer">
              <summary className="font-semibold text-theme-primary flex items-center justify-between">
                <span>What payment methods do you accept?</span>
                <span className="group-open:rotate-180 transition">▼</span>
              </summary>
              <div className="text-theme-secondary mt-4 ml-0">
                <p className="mb-2">We accept payments via:</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                  <li>Mobile money (Hormuud, Somnet, others)</li>
                  <li>Bank transfer</li>
                  <li>WhatsApp/Email for custom arrangements</li>
                </ul>
                <p className="mt-3 text-sm font-semibold">Send payment to: <strong>+252686859656</strong></p>
              </div>
            </details>

            {/* FAQ Item 6 */}
            <details className="group p-4 border-2 border-theme-input rounded-lg hover:border-theme-primary transition cursor-pointer">
              <summary className="font-semibold text-theme-primary flex items-center justify-between">
                <span>Can I bulk import products?</span>
                <span className="group-open:rotate-180 transition">▼</span>
              </summary>
              <p className="text-theme-secondary mt-4 ml-0">
                Yes! Go to <strong>Inventory → Bulk Import</strong> and upload your CSV or Excel file.
                We support all standard spreadsheet formats.
              </p>
            </details>

            {/* FAQ Item 7 */}
            <details className="group p-4 border-2 border-theme-input rounded-lg hover:border-theme-primary transition cursor-pointer">
              <summary className="font-semibold text-theme-primary flex items-center justify-between">
                <span>How do I delete my account?</span>
                <span className="group-open:rotate-180 transition">▼</span>
              </summary>
              <p className="text-theme-secondary mt-4 ml-0">
                Go to <strong>Settings → Account → Delete Account</strong>. This will permanently delete
                your account and all associated data within 30 days.
              </p>
            </details>
          </div>
        </section>

        {/* Contact Section */}
        <section className="mt-16 p-8 bg-cyan-50 border-2 border-cyan-300 rounded-xl">
          <h2 className="text-2xl font-bold text-cyan-900 mb-4">Didn't find what you're looking for?</h2>
          <p className="text-cyan-800 mb-6">
            Our support team is ready to help with any questions or issues you may have.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="mailto:support@yourdomain.com"
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
            >
              Send Email
            </a>
            <a
              href="https://wa.me/252686859656"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Chat on WhatsApp
            </a>
          </div>
        </section>

        <div className="mt-12 p-6 bg-theme-input rounded-lg">
          <h3 className="font-bold text-theme-primary mb-2">📋 Legal Information</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <a href="/legal/terms" className="text-cyan-600 hover:text-cyan-700">
              Terms of Service
            </a>
            <a href="/legal/privacy" className="text-cyan-600 hover:text-cyan-700">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
