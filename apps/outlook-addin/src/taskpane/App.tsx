import { useEffect, useState } from 'react';
import {
  Spinner,
  Tab,
  TabList,
  SelectTabEvent,
  SelectTabData,
} from '@fluentui/react-components';
import {
  DocumentFolderRegular,
  AttachRegular,
  MailTemplateRegular,
  ChatRegular,
} from '@fluentui/react-icons';
import { useEmailContext } from '../hooks/useEmailContext';
import { useStore } from '../hooks/useStore';
import DossierPanel from '../components/DossierPanel';
import AttachmentsPanel from '../components/AttachmentsPanel';
import DraftsPanel from '../components/DraftsPanel';
import ChatBubble from '../components/ChatBubble';

type TabValue = 'dossier' | 'attachments' | 'drafts';

export default function App() {
  const { emailInfo, loading: emailLoading, error: emailError, refresh } = useEmailContext();
  const { status, loading: statusLoading, error: statusError, fetchStatus } = useStore();
  const [selectedTab, setSelectedTab] = useState<TabValue>('dossier');
  const [chatOpen, setChatOpen] = useState(false);

  // Fetch status when email context is ready
  useEffect(() => {
    if (emailInfo?.messageId && emailInfo?.mailbox) {
      fetchStatus(emailInfo.mailbox, emailInfo.messageId);
    }
  }, [emailInfo?.messageId, emailInfo?.mailbox, fetchStatus]);

  const handleTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
    setSelectedTab(data.value as TabValue);
  };

  const isLoading = emailLoading || statusLoading;
  const error = emailError || statusError;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <Spinner size="medium" label="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <div className="text-error mb-4">{error}</div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!emailInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <div className="text-gray-500">
          Select an email to start triaging
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className={`border-b px-4 py-3 ${emailInfo.importance === 'high' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {emailInfo.importance === 'high' && (
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
          )}
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {emailInfo.subject || 'No Subject'}
          </h1>
        </div>
        <p className="text-sm text-gray-500 truncate">
          From: {emailInfo.sender}
        </p>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <TabList
          selectedValue={selectedTab}
          onTabSelect={handleTabSelect}
          className="px-2"
        >
          <Tab value="dossier" icon={<DocumentFolderRegular />}>
            Dossier
          </Tab>
          <Tab
            value="attachments"
            icon={<AttachRegular />}
            disabled={!status?.attachments?.length}
          >
            Attachments {status?.attachments?.length ? `(${status.attachments.length})` : ''}
          </Tab>
          <Tab
            value="drafts"
            icon={<MailTemplateRegular />}
            disabled={!status?.drafts?.length}
          >
            Drafts {status?.drafts?.length ? `(${status.drafts.length})` : ''}
          </Tab>
        </TabList>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {selectedTab === 'dossier' && (
          <DossierPanel
            emailInfo={emailInfo}
            status={status}
          />
        )}
        {selectedTab === 'attachments' && (
          <AttachmentsPanel
            emailInfo={emailInfo}
            attachments={status?.attachments || []}
          />
        )}
        {selectedTab === 'drafts' && (
          <DraftsPanel
            emailInfo={emailInfo}
            drafts={status?.drafts || []}
          />
        )}
      </main>

      {/* Chat Bubble */}
      <ChatBubble
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        mailbox={emailInfo.mailbox}
        messageId={emailInfo.messageId}
      />

      {/* Floating Chat Button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-4 right-4 w-12 h-12 bg-brand-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-brand-600 transition-colors z-10"
          title="Open Chat"
        >
          <ChatRegular className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
