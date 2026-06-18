export const metadata = {
  title: 'Privacy Policy | My Inventory',
  description: 'Privacy Policy for My Inventory inventory management system',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

      <div className="space-y-8 text-theme-secondary">
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">1. Information We Collect</h2>
          <p className="leading-relaxed mb-4">
            We collect information that you provide directly to us, as well as information collected
            automatically when you use our Service:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Account Information:</strong> Email address, password, name, phone number</li>
            <li><strong>Business Information:</strong> Business name, address, tax information</li>
            <li><strong>Product Data:</strong> Inventory records, product details, pricing, stock levels</li>
            <li><strong>Transaction Records:</strong> Sales history, payment information</li>
            <li><strong>Security Data:</strong> IP address, user agent, authentication logs</li>
            <li><strong>Usage Data:</strong> Pages visited, actions performed, time spent</li>
            <li><strong>Device Information:</strong> Device type, browser, operating system</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">2. How We Use Information</h2>
          <p className="leading-relaxed mb-4">
            We use the information we collect for various purposes, including:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Provide, maintain, and improve the Service</li>
            <li>Process transactions and send related information</li>
            <li>Send transactional and promotional communications</li>
            <li>Detect and prevent fraud, abuse, and security incidents</li>
            <li>Comply with legal obligations and enforce agreements</li>
            <li>Monitor and improve Service performance</li>
            <li>Conduct analytics and research on user behavior</li>
            <li>Respond to your inquiries and support requests</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">3. Data Retention</h2>
          <p className="leading-relaxed">
            We retain your personal data for as long as necessary to provide the Service and fulfill the
            purposes outlined in this Privacy Policy. You have the right to request deletion of your data
            at any time. When you delete your account, all associated data will be permanently removed from
            our systems within 30 days, except as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">4. Your Rights (GDPR & Privacy Laws)</h2>
          <p className="leading-relaxed mb-4">
            You have the following rights regarding your personal data:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
            <li><strong>Right to Rectification:</strong> Correct inaccurate data</li>
            <li><strong>Right to Erasure:</strong> Delete your data (right to be forgotten)</li>
            <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
            <li><strong>Right to Data Portability:</strong> Export your data in a standard format</li>
            <li><strong>Right to Object:</strong> Object to processing of your data</li>
            <li><strong>Right to Lodge a Complaint:</strong> File complaints with data protection authorities</li>
          </ul>
          <p className="mt-4">
            To exercise any of these rights, contact us using the information below.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">5. Data Sharing</h2>
          <p className="leading-relaxed">
            We do not sell, trade, or rent your personal data to third parties. We may share your data with:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Service providers who assist in operating our Service (Supabase, Redis, Sentry)</li>
            <li>Legal authorities when required by law</li>
            <li>Business partners with your consent</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">6. Security</h2>
          <p className="leading-relaxed">
            We implement appropriate technical and organizational measures to protect your personal data
            against unauthorized access, alteration, disclosure, or destruction. These measures include:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Encryption of data in transit (HTTPS/TLS)</li>
            <li>Encryption of sensitive data at rest</li>
            <li>Two-factor authentication support</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and role-based permissions</li>
            <li>Activity logging and audit trails</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">7. Cookies and Tracking</h2>
          <p className="leading-relaxed">
            We use cookies and similar tracking technologies to maintain your session, remember preferences,
            and analyze Service usage. You can control cookies through your browser settings. Disabling cookies
            may affect Service functionality.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">8. International Data Transfers</h2>
          <p className="leading-relaxed">
            Your data may be transferred to and processed in countries other than where you reside. By using
            the Service, you consent to such transfers. We ensure appropriate safeguards are in place.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">9. Children's Privacy</h2>
          <p className="leading-relaxed">
            Our Service is not intended for children under 18. We do not knowingly collect data from children.
            If we become aware of such collection, we will delete it immediately.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">10. Changes to This Policy</h2>
          <p className="leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant changes
            by posting the updated policy on the Service and updating the "Last Updated" date below.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">11. Contact Us</h2>
          <p className="leading-relaxed mb-4">
            If you have questions about this Privacy Policy or our privacy practices, please contact us:
          </p>
          <div className="p-4 bg-theme-input rounded-lg space-y-2">
            <p><strong>Email:</strong> yahyaweeko@gmail.com</p>
            <p><strong>WhatsApp:</strong> +252686859656</p>
            <p><strong>Phone:</strong> +252686859656</p>
            <p className="text-sm">Hours: 7 AM - 4 PM GMT+3</p>
          </div>
        </section>

        <div className="text-sm text-gray-500 pt-8 border-t border-theme-input">
          <p>Last Updated: May 31, 2026</p>
        </div>
      </div>
    </div>
  );
}
