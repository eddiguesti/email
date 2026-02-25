import {
  Badge,
  Checkbox,
} from '@fluentui/react-components';
import {
  DocumentPdfRegular,
  DocumentRegular,
  ImageRegular,
  CheckmarkCircleRegular,
  WarningRegular,
} from '@fluentui/react-icons';
import type { EmailInfo } from '../hooks/useEmailContext';

interface Attachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  filed: boolean;
  needsOcr?: boolean;
  extractedText?: string;
}

interface AttachmentsPanelProps {
  emailInfo: EmailInfo;
  attachments: Attachment[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string, name: string) {
  if (contentType.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
    return <DocumentPdfRegular className="w-5 h-5 text-red-500" />;
  }
  if (contentType.startsWith('image/')) {
    return <ImageRegular className="w-5 h-5 text-blue-500" />;
  }
  return <DocumentRegular className="w-5 h-5 text-gray-500" />;
}

export default function AttachmentsPanel({ attachments }: AttachmentsPanelProps) {
  if (attachments.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center text-gray-500 py-8">
          No attachments in this email
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="text-sm text-gray-500 mb-2">
        {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
      </div>

      {attachments.map((attachment, index) => (
        <div
          key={attachment.id}
          className="card card-hover animate-slide-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-start gap-3">
            {/* File Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {getFileIcon(attachment.contentType, attachment.name)}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate" title={attachment.name}>
                {attachment.name}
              </div>
              <div className="text-sm text-gray-500">
                {formatFileSize(attachment.size)}
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-1 mt-2">
                {attachment.filed && (
                  <Badge
                    appearance="filled"
                    color="success"
                    icon={<CheckmarkCircleRegular />}
                  >
                    Filed
                  </Badge>
                )}
                {attachment.needsOcr && (
                  <Badge
                    appearance="filled"
                    color="warning"
                    icon={<WarningRegular />}
                  >
                    Needs OCR
                  </Badge>
                )}
                {attachment.extractedText && (
                  <Badge appearance="outline" color="informative">
                    Text Extracted
                  </Badge>
                )}
              </div>

              {/* Extracted Text Preview */}
              {attachment.extractedText && (
                <details className="mt-2">
                  <summary className="text-xs text-brand-500 cursor-pointer hover:underline">
                    Show extracted text
                  </summary>
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 max-h-32 overflow-y-auto">
                    {attachment.extractedText.slice(0, 500)}
                    {attachment.extractedText.length > 500 && '...'}
                  </div>
                </details>
              )}
            </div>

            {/* Selection Checkbox */}
            <div className="flex-shrink-0">
              <Checkbox
                disabled={attachment.filed}
                defaultChecked={!attachment.filed}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
        {attachments.filter(a => a.filed).length} of {attachments.length} filed to Kleos
      </div>
    </div>
  );
}
