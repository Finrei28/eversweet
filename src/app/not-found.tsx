import NotFoundMessage from "./components/notFoundMessage";

/**
 * Every 404 on the site: an address nothing answers, and every `notFound()`, including the
 * admin pages' answer to a visitor who is not signed in. It was Next's own 404 copied in,
 * black on white and English only.
 */
export default function NotFound() {
  return <NotFoundMessage />;
}
