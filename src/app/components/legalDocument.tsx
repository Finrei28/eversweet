import MaxWidthWapper from "~/app/components/maxWidthWrapper";
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
    <MaxWidthWapper>
      <div className="py-12 md:py-16">
        <h1 className="mb-2 text-center text-3xl font-bold md:text-4xl">
          {resolved.title}
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Last updated: {resolved.lastUpdated}
        </p>

        <div className="mx-auto max-w-3xl">
          {resolved.sections.map((section) => {
            const label = platformLabel(section.appliesTo);

            return (
              <section key={section.heading} className="mt-8">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-xl font-semibold md:text-2xl">
                    {section.heading}
                  </h2>
                  {label && (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                      {label}
                    </span>
                  )}
                </div>

                {section.content && (
                  <p className="mt-3 text-muted-foreground">
                    {section.content}
                  </p>
                )}

                {section.list && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </MaxWidthWapper>
  );
}
