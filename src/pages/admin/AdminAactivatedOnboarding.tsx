import { useEffect, useState, type FormEvent } from "react";
import DashLayout from "../../components/layout/DashLayout";
import { supabase } from "../../lib/supabase";

type Row = {
  id: string;
  state: string;
  account_status: string;
  agreement_status: string;
  w9_status: string;
  starter_kit_status: string;
  payout_status: string;
  approved_at: string | null;
  activated_at: string | null;
  last_activity_at: string;
  application?: {
    id?: string;
    full_name?: string;
    email?: string;
    referral_rep?: string;
    approval_status?: string;
  } | null;
};
type W9 = {
  id: string;
  onboarding_id: string;
  status: string;
  tax_name: string;
  tin_last_four: string;
  created_at: string;
  signed_at: string;
  pdf_storage_path: string | null;
  correction_reason: string | null;
};
type Payout = {
  id: string;
  onboarding_id: string;
  verification_status: string;
  masked_destination: string;
  submitted_at: string;
  admin_notes: string | null;
};
type Agreement = {
  id: string;
  onboarding_id: string;
  legal_name: string;
  agreement_version: string;
  signed_at: string;
  pdf_storage_path: string | null;
};
export default function AdminAactivatedOnboarding() {
  const [rows, setRows] = useState<Row[]>([]),
    [w9s, setW9s] = useState<W9[]>([]),
    [payouts, setPayouts] = useState<Payout[]>([]),
    [agreements, setAgreements] = useState<Agreement[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(""),
    [opening, setOpening] = useState("");
  async function load() {
    const [r, snapshot] = await Promise.all([
      supabase!
        .from("aactivated_onboarding_profiles")
        .select(
          "id,state,account_status,agreement_status,w9_status,starter_kit_status,payout_status,approved_at,activated_at,last_activity_at,application:rep_store_intake_submissions(id,full_name,email,referral_rep,approval_status)",
        )
        .eq("brand_id", "aactivated")
        .order("last_activity_at", { ascending: false }),
      supabase!.functions.invoke("manage-aactivated-onboarding", {
        body: { action: "status_snapshot" },
      }),
    ]);
    const failure = r.error || snapshot.error;
    if (failure) setError(failure.message);
    else {
      setRows((r.data ?? []) as unknown as Row[]);
      setW9s((snapshot.data?.w9s ?? []) as W9[]);
      setPayouts((snapshot.data?.payouts ?? []) as Payout[]);
      setAgreements((snapshot.data?.agreements ?? []) as Agreement[]);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function invoke(
    name: string,
    body: Record<string, unknown>,
    key: string,
  ) {
    setSaving(key);
    setError("");
    setMessage("");
    const { data, error: fnError } = await supabase!.functions.invoke(name, {
      body,
    });
    setSaving("");
    if (fnError || data?.error) {
      setError(String(data?.error || fnError?.message || "Action failed"));
      return false;
    }
    setMessage("Administrative action completed and recorded.");
    await load();
    return true;
  }
  async function approve(row: Row) {
    if (!readyForFinalReview(row)) {
      setError(
        "Final approval is available after the rep submits the agreement, W-9, starter-kit purchase attestation, payout information, and account confirmation.",
      );
      return;
    }
    const code = window.prompt(
      "Permanent representative code (letters and numbers only):",
    );
    if (!code || !row.application?.id) return;
    const note =
      window.prompt("Final approval note:") ||
      "All representative submissions reviewed and approved";
    await invoke(
      "approve-aactivated-onboarding",
      {
        application_id: row.application.id,
        rep_code: code,
        internal_note: note,
      },
      `approve-${row.id}`,
    );
  }
  async function decision(
    row: Row,
    action: "application_more_info" | "application_denied",
  ) {
    if (!row.application?.id) return;
    const reason = window.prompt(
      action === "application_denied"
        ? "Enter denial reason (minimum 10 characters):"
        : "Describe the additional information required (minimum 10 characters):",
    );
    if (!reason || reason.trim().length < 10) return;
    await invoke(
      "manage-aactivated-onboarding",
      { action, application_id: row.application.id, reason },
      `${action}-${row.id}`,
    );
  }
  async function activate(id: string) {
    setSaving(`activate-${id}`);
    setError("");
    const { error: actionError } = await supabase!.rpc(
      "activate_aactivated_onboarding",
      { p_onboarding_id: id },
    );
    setSaving("");
    if (actionError) setError(actionError.message);
    else setMessage("Representative portal activated.");
    await load();
  }
  async function openDocument(
    type: "agreement" | "w9",
    id: string,
    disposition: "view" | "download",
  ) {
    const key = `${type}-${id}-${disposition}`;
    setOpening(key);
    setError("");
    const { data, error: fnError } = await supabase!.functions.invoke(
      "manage-aactivated-onboarding",
      {
        body: {
          action: "document_url",
          document_type: type,
          document_id: id,
          disposition,
        },
      },
    );
    setOpening("");
    if (fnError || data?.error || !data?.signed_url) {
      setError(
        String(
          data?.error || fnError?.message || "Unable to open signed document.",
        ),
      );
      return;
    }
    window.open(String(data.signed_url), "_blank", "noopener,noreferrer");
  }
  function exportReport() {
    const header =
      "Name,Email,Application,Account,Agreement,W9,Starter Kit,Payout,State,Last Activity\n";
    const body = rows
      .map((row) =>
        [
          row.application?.full_name,
          row.application?.email,
          row.application?.approval_status,
          row.account_status,
          row.agreement_status,
          row.w9_status,
          row.starter_kit_status,
          row.payout_status,
          row.state,
          row.last_activity_at,
        ]
          .map(csv)
          .join(","),
      )
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([header + body], { type: "text/csv" }),
    );
    a.download = "aactivated-onboarding-nonsensitive.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <DashLayout role="admin">
      <div style={{ display: "grid", gap: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="eyebrow">AACTIVATEDRX administration</p>
            <h1>New Rep Processing Center</h1>
            <p>
              One place for applications, signed documents, compliance review,
              starter-kit attestation, payout review, and final activation.
              Sensitive values remain masked.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={exportReport}>
            Export non-sensitive report
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}
        <SignedDocuments
          rows={rows}
          agreements={agreements}
          w9s={w9s}
          opening={opening}
          openDocument={openDocument}
        />
        <AgreementPublisher invoke={invoke} />
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rep</th>
                <th>Application</th>
                <th>Agreement</th>
                <th>W-9 submission</th>
                <th>Starter kit</th>
                <th>Payout submission</th>
                <th>Overall</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const w9 = w9s.find((item) => item.onboarding_id === row.id),
                  payout = payouts.find(
                    (item) => item.onboarding_id === row.id,
                  );
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>
                        {row.application?.full_name ?? "Pending rep"}
                      </strong>
                      <br />
                      <small>{row.application?.email}</small>
                    </td>
                    <td>{row.application?.approval_status || "pending"}</td>
                    <td>{row.agreement_status}</td>
                    <td>
                      {w9 ? (
                        <>
                          <strong>{w9.status}</strong>
                          <br />
                          <small>
                            {w9.tax_name} · TIN ••••{w9.tin_last_four}
                          </small>
                        </>
                      ) : (
                        "not submitted"
                      )}
                    </td>
                    <td>{row.starter_kit_status}</td>
                    <td>
                      {payout ? (
                        <>
                          <strong>{payout.verification_status}</strong>
                          <br />
                          <small>{payout.masked_destination}</small>
                        </>
                      ) : (
                        "not submitted"
                      )}
                    </td>
                    <td>{row.state}</td>
                    <td style={{ minWidth: 230 }}>
                      {row.application?.approval_status !== "approved" && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={Boolean(saving) || !readyForFinalReview(row)}
                            onClick={() => void approve(row)}
                          >
                            {readyForFinalReview(row)
                              ? "Final Approve & Activate"
                              : "Awaiting Rep Submission"}
                          </button>{" "}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              void decision(row, "application_more_info")
                            }
                          >
                            More info
                          </button>{" "}
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              void decision(row, "application_denied")
                            }
                          >
                            Deny
                          </button>
                        </>
                      )}{" "}
                      {row.application?.approval_status === "approved" && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={Boolean(saving) || row.state === "active"}
                          onClick={() => void activate(row.id)}
                        >
                          {row.state === "active"
                            ? "Active"
                            : "Verify & activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashLayout>
  );
}
function AgreementPublisher({
  invoke,
}: {
  invoke: (
    name: string,
    body: Record<string, unknown>,
    key: string,
  ) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    const ok = await invoke(
      "manage-aactivated-onboarding",
      {
        action: "publish_agreement",
        title: data.get("title"),
        version: data.get("version"),
        effective_date: data.get("effective_date"),
        content: data.get("content"),
        company_signer_name: data.get("company_signer_name"),
        company_signature_text: data.get("company_signature_text"),
        legal_approval_confirmed: data.has("legal_approval_confirmed"),
        company_signature_confirmed: data.has("company_signature_confirmed"),
      },
      "agreement",
    );
    if (ok) {
      form.reset();
      setOpen(false);
    }
  }
  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <div>
          <strong>Agreement review and company signoff</strong>
          <p>
            Central location for the final agreement. Reps may complete their
            other onboarding steps while this remains under review.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setOpen(!open)}>
          {open ? "Cancel" : "Review & sign for company"}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <input
            className="form-input"
            name="title"
            placeholder="Agreement title"
            required
          />
          <div className="form-grid-2">
            <input
              className="form-input"
              name="version"
              placeholder="Version"
              required
            />
            <input
              className="form-input"
              name="effective_date"
              type="date"
              required
            />
          </div>
          <textarea
            className="form-textarea"
            name="content"
            rows={12}
            minLength={100}
            placeholder="Paste the complete legally approved agreement"
            required
          />
          <div className="form-grid-2">
            <input
              className="form-input"
              name="company_signer_name"
              placeholder="Authorized company signer legal name"
              required
            />
            <input
              className="form-input"
              name="company_signature_text"
              placeholder="Electronic company signature"
              required
            />
          </div>
          <label>
            <input name="legal_approval_confirmed" type="checkbox" required /> I
            confirm this exact agreement text has completed company/legal
            review.
          </label>
          <label>
            <input
              name="company_signature_confirmed"
              type="checkbox"
              required
            />{" "}
            I am authorized to sign electronically for PepScriptRX /
            AACTIVATEDRX and intend this as the company signature.
          </label>
          <button className="btn btn-primary">Company Sign & Publish</button>
        </form>
      )}
    </div>
  );
}
function readyForFinalReview(row: Row) {
  return (
    row.account_status === "complete" &&
    row.agreement_status === "complete" &&
    ["submitted", "under_review", "accepted"].includes(row.w9_status) &&
    row.starter_kit_status === "complete" &&
    ["submitted", "verified", "complete"].includes(row.payout_status)
  );
}
function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function SignedDocuments({
  rows,
  agreements,
  w9s,
  opening,
  openDocument,
}: {
  rows: Row[];
  agreements: Agreement[];
  w9s: W9[];
  opening: string;
  openDocument: (
    type: "agreement" | "w9",
    id: string,
    disposition: "view" | "download",
  ) => Promise<void>;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <h2>Signed Agreement & W-9 Center</h2>
      <p>
        Secure five-minute document links. Every view and download is recorded
        in the onboarding audit log.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((row) => {
          const agreement = agreements.find(
              (item) => item.onboarding_id === row.id,
            ),
            w9 = w9s.find(
              (item) =>
                item.onboarding_id === row.id && item.status !== "superseded",
            );
          return (
            <div key={row.id} className="card" style={{ padding: 16 }}>
              <strong>
                {row.application?.full_name ?? "Pending representative"}
              </strong>
              <br />
              <small>{row.application?.email}</small>
              <div className="form-grid-2" style={{ marginTop: 12 }}>
                <SecureDocument
                  title="Signed Rep Agreement"
                  detail={
                    agreement
                      ? `Version ${agreement.agreement_version} · Signed by ${agreement.legal_name}`
                      : "Not signed"
                  }
                  record={agreement}
                  type="agreement"
                  opening={opening}
                  openDocument={openDocument}
                />
                <SecureDocument
                  title="Signed Form W-9"
                  detail={
                    w9
                      ? `${w9.tax_name} · TIN ending ${w9.tin_last_four} · ${w9.status}`
                      : "Not submitted"
                  }
                  record={w9}
                  type="w9"
                  opening={opening}
                  openDocument={openDocument}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function SecureDocument({
  title,
  detail,
  record,
  type,
  opening,
  openDocument,
}: {
  title: string;
  detail: string;
  record: { id: string; pdf_storage_path: string | null } | undefined;
  type: "agreement" | "w9";
  opening: string;
  openDocument: (
    type: "agreement" | "w9",
    id: string,
    disposition: "view" | "download",
  ) => Promise<void>;
}) {
  if (!record?.pdf_storage_path)
    return (
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
        <span className="badge">PDF unavailable</span>
      </div>
    );
  return (
    <div>
      <strong>{title}</strong>
      <p>{detail}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className="btn btn-secondary btn-sm"
          disabled={Boolean(opening)}
          onClick={() => void openDocument(type, record.id, "view")}
        >
          {opening === `${type}-${record.id}-view` ? "Opening…" : "View PDF"}
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={Boolean(opening)}
          onClick={() => void openDocument(type, record.id, "download")}
        >
          {opening === `${type}-${record.id}-download`
            ? "Preparing…"
            : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
