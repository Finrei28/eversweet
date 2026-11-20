import {
  DOC_LIST,
  DOC_TEXT,
  DocumentPage,
  DocumentSection,
} from "~/app/components/documentPage";
import {
  type LegalDocument,
  platformLabel,
  resolveLegalDocument,
} from "~/lib/legalDocuments";
import { oneLineAddress } from "~/lib/shopSettings";
import { getShopProfile } from "~/server/shopProfile";

/**
 * Renders a legal document from `~/lib/legalDocuments`, which is the same file the order
 * server serves to the app. Both platforms show the same words, and the sections that only
 * apply to one of them say so.
 *
 * This replaced a 234-line hand-written privacy policy that had drifted from the app's
 * copy: different text, different sections, the same "last updated" date, and each claiming
 * things the other did not.
 *
 * English only, as the app is. The rest of this site is bilingual, but a translated legal
 * document raises the question of which version governs when they disagree, and a
 * mistranslated obligation is worse than an untranslated one. That is a decision for a
 * translator working alongside whoever reviews the English.
 */
export default async function LegalDocumentPage({
  document,
}: {
  document: LegalDocument;
}) {
  const profile = await getShopProfile();
  const resolved = resolveLegalDocument(document, {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    address: oneLineAddress(profile),
    website: profile.website,
  });

  return (
    <DocumentPage
      title={resolved.title}
      subtitle={`Last updated: ${resolved.lastUpdated}`}
    >
      {resolved.sections.map((section) => (
        <DocumentSection
          key={section.heading}
          heading={section.heading}
          label={platformLabel(section.appliesTo)}
        >
          {section.content && <p className={DOC_TEXT}>{section.content}</p>}
          {section.list && (
            <ul className={DOC_LIST}>
              {section.list.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </DocumentSection>
      ))}
    </DocumentPage>
  );
}
