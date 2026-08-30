import { z } from "zod";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { CREATE_NOVEL_MODAL, NewNovelModal } from "./novel/new-novel-modal";

/**
 * Registry of modals the app shell can open via the `?modal=` search param.
 *
 * Owned here, not in any one modal's file: each modal contributes its content
 * (and its id constant), while this file owns the mechanism - the param schema,
 * reading the param, rendering the open modal over the current page, and
 * closing it. Adding a modal means creating its component and widening the
 * enum + switch below.
 */
export const ModalSearchSchema = z.object({
  modal: z.enum([CREATE_NOVEL_MODAL]).optional().catch(undefined),
});

export function AppModals() {
  const { modal } = useSearch({ strict: false });
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Closing replaces the history entry so the browser back button always
  // undoes the modal: back from the open modal goes to the pre-modal page,
  // never re-opens a modal the operator explicitly closed. "to" must be the
  // concrete pathname so we stay on the page the modal was opened over.
  const closeModal = () =>
    navigate({
      to: pathname,
      search: (prev) => ({ ...prev, modal: undefined }),
      replace: true,
    });

  switch (modal) {
    case CREATE_NOVEL_MODAL:
      return <NewNovelModal onClose={closeModal} />;
    default:
      return null;
  }
}
