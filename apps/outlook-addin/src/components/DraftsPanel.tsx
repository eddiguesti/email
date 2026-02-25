import { useState } from 'react';
import {
  Button,
  Badge,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
} from '@fluentui/react-components';
import {
  MailRegular,
  SendRegular,
  DocumentAddRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons';
import { useStore } from '../hooks/useStore';
import type { EmailInfo } from '../hooks/useEmailContext';

interface Draft {
  id: string;
  type: string;
  subject: string;
  body: string;
  to: string[];
  createdAt: string;
  insertedAt?: string;
  sentAt?: string;
}

interface DraftsPanelProps {
  emailInfo: EmailInfo;
  drafts: Draft[];
}

const DRAFT_TYPE_LABELS: Record<string, string> = {
  reply: 'Reply',
  client_transmittal: 'Client Transmittal',
  fee_reminder_1: 'Fee Reminder (1st)',
  fee_reminder_2: 'Fee Reminder (2nd)',
  fee_reminder_final: 'Fee Reminder (Final)',
  leave_acknowledgement: 'Leave Acknowledgement',
};

const DRAFT_TYPES = [
  { value: 'reply', label: 'Reply' },
  { value: 'client_transmittal', label: 'Client Transmittal' },
  { value: 'fee_reminder_1', label: 'Fee Reminder (1st)' },
];

export default function DraftsPanel({ emailInfo, drafts }: DraftsPanelProps) {
  const { generateDrafts, insertDraft, loading } = useStore();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async (types: string[]) => {
    setGenerating(true);
    await generateDrafts(emailInfo.mailbox, emailInfo.messageId, types);
    setGenerating(false);
  };

  const handleInsert = async (draftId: string) => {
    await insertDraft(emailInfo.mailbox, emailInfo.messageId, draftId);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Generate Drafts Section */}
      <div className="card animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <DocumentAddRegular className="w-5 h-5 text-brand-500" />
          <span className="font-medium">Generate Drafts</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {DRAFT_TYPES.map((type) => {
            const exists = drafts.some((d) => d.type === type.value);
            return (
              <Button
                key={type.value}
                size="small"
                appearance={exists ? 'secondary' : 'primary'}
                disabled={generating || loading}
                onClick={() => handleGenerate([type.value])}
              >
                {type.label}
                {exists && ' (Regenerate)'}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Existing Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-gray-500">
            {drafts.length} draft{drafts.length !== 1 ? 's' : ''} available
          </div>

          <Accordion collapsible>
            {drafts.map((draft) => (
              <AccordionItem key={draft.id} value={draft.id}>
                <AccordionHeader>
                  <div className="flex items-center gap-2 w-full">
                    <MailRegular className="w-4 h-4" />
                    <span className="flex-1 truncate">
                      {DRAFT_TYPE_LABELS[draft.type] || draft.type}
                    </span>
                    {draft.insertedAt && (
                      <Badge appearance="filled" color="success" size="small">
                        Inserted
                      </Badge>
                    )}
                    {draft.sentAt && (
                      <Badge appearance="filled" color="brand" size="small">
                        Sent
                      </Badge>
                    )}
                  </div>
                </AccordionHeader>
                <AccordionPanel>
                  <div className="space-y-3 animate-fade-in">
                    {/* Subject */}
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        Subject
                      </div>
                      <div className="text-sm font-medium">{draft.subject}</div>
                    </div>

                    {/* To */}
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        To
                      </div>
                      <div className="text-sm">{draft.to.join(', ')}</div>
                    </div>

                    {/* Body Preview */}
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                        Preview
                      </div>
                      <div className="text-sm bg-gray-50 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                        {draft.body.slice(0, 500)}{draft.body.length > 500 ? '…' : ''}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="small"
                        appearance="primary"
                        icon={draft.insertedAt ? <CheckmarkCircleRegular /> : <SendRegular />}
                        disabled={loading || !!draft.insertedAt}
                        onClick={() => handleInsert(draft.id)}
                      >
                        {draft.insertedAt ? 'Already Inserted' : 'Insert as Draft'}
                      </Button>
                    </div>

                    {/* Timestamps */}
                    <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                      Created: {new Date(draft.createdAt).toLocaleString()}
                      {draft.insertedAt && (
                        <> | Inserted: {new Date(draft.insertedAt).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* Empty State */}
      {drafts.length === 0 && (
        <div className="text-center text-gray-500 py-4">
          No drafts generated yet. Click a button above to create one.
        </div>
      )}
    </div>
  );
}
