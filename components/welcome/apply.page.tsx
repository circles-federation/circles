"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CameraIcon } from "@heroicons/react/24/outline";
import { Button, Eyebrow, Input, Label, Select, useToast } from "@/components/shared";
import { toSquareJpeg } from "@/components/profile/photo-picker";
import { confirmApplicationCode, resendApplicationCode, submitApplication } from "@/lib/apply";
import { BetaPrivacy } from "@/components/legal/beta-privacy";
import { BetaTerms } from "@/components/legal/beta-terms";
import { APPLICATION_NAME_MAX, BETA_AGREEMENT_VERSION, validateApplication, type ApplicationErrors, type ApplicationInput } from "@/lib/applications.util";

type Step = "form" | "agree" | "confirm" | "done";

interface ApplyPageProps {
  neighborhoods: { id: string; name: string }[];
}

/* Applying to join — there's no sign-up: every application is read by a
   system admin, who checks the photo is a real face. Four steps: the form; the beta terms and privacy notes,
   which they agree to by sending it; the code emailed to them, which proves the
   address is theirs and sends the application for review; and a "thanks,
   we'll email you". Outside the signed-in app, so it's laid out like the
   welcome page rather than under a top bar. */
export function ApplyPage({ neighborhoods }: ApplyPageProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("form");
  const [input, setInput] = useState<ApplicationInput>({ firstName: "", lastName: "", email: "", neighborhoodId: "" });
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [errors, setErrors] = useState<ApplicationErrors>({});
  const [applicationId, setApplicationId] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<ApplicationInput>) => setInput((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  function handleContinue(e: FormEvent) {
    e.preventDefault();
    const found = validateApplication(input, !!photo);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep("agree");
  }

  async function handleAgree() {
    if (busy || !photo) return;
    const form = new FormData();
    for (const [key, value] of Object.entries(input)) form.set(key, value);
    form.set("photo", photo, "photo.jpg");
    form.set("agreementVersion", BETA_AGREEMENT_VERSION);
    setBusy(true);
    const result = await submitApplication(form);
    setBusy(false);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't send your application", message: result.error });
      return;
    }
    setApplicationId(result.id);
    setDevCode(result.code ?? null);
    setStep("confirm");
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (busy || code.trim().length !== 6) return;
    setBusy(true);
    const result = await confirmApplicationCode(applicationId, code);
    setBusy(false);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't confirm that code", message: result.error });
      return;
    }
    setStep("done");
  }

  async function handleResend() {
    if (busy) return;
    setBusy(true);
    const result = await resendApplicationCode(applicationId);
    setBusy(false);
    if (!result.ok) {
      showToast({ tone: "error", title: "Couldn't send a new code", message: result.error });
      return;
    }
    setDevCode(result.code ?? null);
    setCode("");
    showToast({ tone: "success", title: "New code sent", message: `Check ${input.email.trim()} for it.` });
  }

  return (
    <div className="flex min-h-dvh justify-center bg-paper px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <Link href="/" className="-ml-1 inline-flex items-center gap-1.5 font-sans text-xs font-bold tracking-caps text-ink uppercase no-underline">
          <ArrowLeftIcon className="size-4" strokeWidth={2.5} />
          Sign in instead
        </Link>

        <div className="mt-6 border-t-[3px] border-t-ink pt-5">
          <Eyebrow className="text-soft">Apply to join</Eyebrow>
          <h1 className="mt-3 font-sans text-hero font-extrabold tracking-[-0.04em] leading-[0.9]">Circles</h1>
          {step === "form" && (
            <p className="mt-4 mb-7 font-serif text-lg leading-normal text-body">
              Circles is for neighbors. Every application is read by a person, who checks that your photo shows your face and that you live in the neighborhood you choose.
            </p>
          )}
        </div>

        {step === "form" && (
          <form onSubmit={handleContinue} noValidate className="flex flex-col gap-6">
            <PhotoField photo={photo} onChange={setPhoto} error={errors.photo} />

            <div className="grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 min-[480px]:gap-3">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={input.firstName} onChange={(e) => set({ firstName: e.target.value })} maxLength={APPLICATION_NAME_MAX} autoComplete="given-name" />
                <FieldError message={errors.firstName} />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={input.lastName} onChange={(e) => set({ lastName: e.target.value })} maxLength={APPLICATION_NAME_MAX} autoComplete="family-name" />
                <FieldError message={errors.lastName} />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={input.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" autoComplete="email" />
              <FieldError message={errors.email} hint="We'll send a code here to confirm it's yours, and you'll sign in with it." />
            </div>

            <div>
              <Label htmlFor="neighborhood">Neighborhood</Label>
              <Select id="neighborhood" value={input.neighborhoodId} onChange={(e) => set({ neighborhoodId: e.target.value })}>
                <option value="">Choose where you live</option>
                {neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </Select>
              <FieldError message={errors.neighborhoodId} />
            </div>

            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        )}

        {step === "agree" && (
          <div className="mt-7">
            <p className="font-serif text-lg leading-normal text-body">
              Before you send your application, please read the short terms and privacy notes for the beta.
            </p>
            <h2 className="mt-9 border-t border-t-ink pt-4 font-sans text-xl font-extrabold tracking-[-0.02em]">Beta terms</h2>
            <BetaTerms />
            <h2 className="mt-9 border-t border-t-ink pt-4 font-sans text-xl font-extrabold tracking-[-0.02em]">Privacy</h2>
            <BetaPrivacy />
            <Button type="button" onClick={handleAgree} disabled={busy} className="mt-9 w-full">
              {busy ? "Sending…" : "Agree and send"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("form")} disabled={busy} className="mt-3 w-full">
              Back to your application
            </Button>
          </div>
        )}

        {step === "confirm" && (
          <form onSubmit={handleConfirm} className="mt-7">
            <p className="mb-4 font-serif text-lg leading-normal text-body">
              One more step. We sent a code to <strong className="text-ink">{input.email.trim()}</strong> — enter it here to send your application for review.
            </p>
            {devCode && (
              <div className="mb-4 border border-dashed border-soft px-3 py-3 font-sans text-sm text-soft">
                Dev mode — here&apos;s your code (production only emails it):{" "}
                <strong className="tracking-[0.08em] text-ink">{devCode}</strong>
              </div>
            )}
            <Label htmlFor="code">Confirmation code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="tracking-[0.2em]"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="go"
            />
            <Button type="submit" disabled={busy || code.trim().length !== 6} className="mt-4 w-full">
              {busy ? "Confirming…" : "Confirm"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleResend} disabled={busy} className="mt-3 w-full">
              Send a new code
            </Button>
          </form>
        )}

        {step === "done" && (
          <div className="mt-7">
            <p className="font-serif text-lg leading-normal text-body">
              Thank you, {input.firstName.trim()}. Your application is with us. Once someone has reviewed it, we&apos;ll email <strong className="text-ink">{input.email.trim()}</strong> to let you know.
            </p>
            <Link href="/" className="mt-7 inline-block font-sans text-sm font-bold text-ink underline underline-offset-2">
              Back to the welcome page
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldError({ message, hint }: { message?: string; hint?: string }) {
  if (message) return <p className="mt-1.5 font-sans text-xs font-bold text-danger">{message}</p>;
  return hint ? <p className="mt-1.5 font-serif text-sm leading-normal text-soft">{hint}</p> : null;
}

// the applicant's photo: cropped square and shrunk in the browser, as a
// profile photo is, and shown back to them before it's sent
function PhotoField({ photo, onChange, error }: { photo: Blob | null; onChange: (photo: Blob) => void; error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let square: Blob;
    try {
      square = await toSquareJpeg(file);
    } catch {
      setReadError("Couldn't read that image — try a JPEG or PNG.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(square);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setReadError(null);
    onChange(square);
  }

  const problem = readError ?? error;
  return (
    <div>
      <Label>Photo</Label>
      <div className="flex items-center gap-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview (object URL), which next/image can't optimize
          <img src={previewUrl} alt="Your photo" className="size-24 shrink-0 border border-ink object-cover" />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center border border-dashed border-soft text-soft">
            <CameraIcon className="size-8" strokeWidth={1.5} />
          </div>
        )}
        <div>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <Button type="button" variant="secondary" size="compact" onClick={() => inputRef.current?.click()}>
            <CameraIcon className="size-4" strokeWidth={2} />
            {photo ? "Choose another" : "Choose photo"}
          </Button>
          {problem ? (
            <p className="mt-2 font-sans text-xs font-bold text-danger">{problem}</p>
          ) : (
            <p className="mt-2 font-serif text-sm leading-normal text-soft">A clear photo of your face. It becomes your profile photo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
