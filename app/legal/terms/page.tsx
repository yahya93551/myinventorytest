export const metadata = {
  title: 'Terms of Service | My Inventory',
  description: 'Terms of Service for My Inventory inventory management system',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

      <div className="space-y-8 text-theme-secondary">
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">1. Acceptance of Terms</h2>
          <p className="leading-relaxed">
            By accessing and using My Inventory ("the Service"), you accept and agree to be bound by
            the terms and provision of this agreement. If you do not agree to abide by the above, please
            do not use this service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">2. Use License</h2>
          <p className="leading-relaxed mb-4">
            Permission is granted to temporarily download one copy of the materials (information or
            software) on My Inventory for personal, non-commercial transitory viewing only. This is the
            grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Modifying or copying the materials</li>
            <li>Using the materials for any commercial purpose or for any public display</li>
            <li>Attempting to decompile or reverse engineer any software contained on the Service</li>
            <li>Removing any copyright or other proprietary notations from the materials</li>
            <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
            <li>Using data mining, robots, screen scraping, or similar data gathering and extraction tools</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">3. Disclaimer</h2>
          <p className="leading-relaxed">
            The materials on My Inventory are provided on an "as is" basis. My Inventory makes no
            warranties, expressed or implied, and hereby disclaims and negates all other warranties
            including, without limitation, implied warranties or conditions of merchantability, fitness
            for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">4. Limitations</h2>
          <p className="leading-relaxed">
            In no event shall My Inventory or its suppliers be liable for any damages (including, without
            limitation, damages for loss of data or profit, or due to business interruption) arising out of
            the use or inability to use the materials on the Service, even if My Inventory or an authorized
            representative has been notified orally or in writing of the possibility of such damage.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">5. Accuracy of Materials</h2>
          <p className="leading-relaxed">
            The materials appearing on My Inventory could include technical, typographical, or photographic
            errors. My Inventory does not warrant that any of the materials on the Service are accurate,
            complete, or current. My Inventory may make changes to the materials contained on the Service
            at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">6. Links</h2>
          <p className="leading-relaxed">
            My Inventory has not reviewed all of the sites linked to its website and is not responsible
            for the contents of any such linked site. The inclusion of any link does not imply endorsement
            by My Inventory of the site. Use of any such linked website is at the user's own risk.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">7. Modifications</h2>
          <p className="leading-relaxed">
            My Inventory may revise these Terms of Service for the Service at any time without notice.
            By using the Service, you are agreeing to be bound by the then current version of these
            Terms of Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">8. Governing Law</h2>
          <p className="leading-relaxed">
            These terms and conditions are governed by and construed in accordance with the laws of Somalia
            and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-theme-primary">9. Contact Information</h2>
          <p className="leading-relaxed">
            If you have any questions about these Terms of Service, please contact us at:
          </p>
          <div className="mt-4 p-4 bg-theme-input rounded-lg">
            <p className="font-semibold">Email: support@yourdomain.com</p>
            <p className="font-semibold">WhatsApp: +252686859656</p>
            <p className="text-sm mt-2">Hours: 9 AM - 5 PM GMT+3</p>
          </div>
        </section>

        <div className="text-sm text-gray-500 pt-8 border-t border-theme-input">
          <p>Last Updated: May 31, 2026</p>
        </div>
      </div>
    </div>
  );
}
