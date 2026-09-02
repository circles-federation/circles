// Barrel — re-exports every shared/chrome component from one import path
// (e.g. `import { Button, Label, Input } from "@/components/shared";`)
// instead of one path per component. Existing call sites that import a
// single file directly (e.g. `@/components/shared/button`) still work;
// this is just a shorter option for new code.
export { AppShell } from "./app-shell";
export { Avatar } from "./avatar";
export { BackButton } from "./back-button";
export { BottomNav } from "./bottom-nav";
export { Button } from "./button";
export { Chip } from "./chip";
export { ConfirmModal } from "./confirm-modal";
export { Eyebrow } from "./eyebrow";
export { EyebrowGroup } from "./eyebrow-group";
export { FloatingActionButton } from "./floating-action-button";
export { FolderGrid } from "./folder-grid";
export { ForwardLink } from "./forward-link";
export { Input } from "./input";
export { Label } from "./label";
export { Modal } from "./modal";
export { PageContainer } from "./page-container";
export { PageHeader } from "./page-header";
export { SearchWithFilter } from "./search-with-filter";
export { Section } from "./section";
export { SectionGroup } from "./section-group";
export { Select } from "./select";
export { TabbedPanel } from "./tabbed-panel";
export { Tag } from "./tag";
export { TextArea } from "./text-area";
export { useToast, ToastProvider } from "./toast";
export { TopBar } from "./top-bar";
