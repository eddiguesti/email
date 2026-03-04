/**
 * GET /api/outlook-addin/manifest
 * Serves the Outlook add-in manifest.xml with the live app URL injected.
 * Content is embedded here so it works on Vercel (no cross-package file traversal needed).
 */
export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp
  xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides/1.0"
  xsi:type="MailApp">

  <Id>36cea1a9-40df-4050-b9fb-e41df48eb617</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>The Grand Azure Hotel</ProviderName>
  <DefaultLocale>en-GB</DefaultLocale>
  <DisplayName DefaultValue="Grand Azure Bot - Email Routing"/>
  <Description DefaultValue="AI-powered email routing and booking assignment for The Grand Azure Hotel"/>

  <IconUrl DefaultValue="${appUrl}/assets/icon-32.png"/>
  <HighResolutionIconUrl DefaultValue="${appUrl}/assets/icon-80.png"/>
  <SupportUrl DefaultValue="${appUrl}"/>

  <AppDomains>
    <AppDomain>${appUrl}</AppDomain>
  </AppDomains>

  <Hosts>
    <Host Name="Mailbox"/>
  </Hosts>

  <Requirements>
    <Sets>
      <Set Name="Mailbox" MinVersion="1.1"/>
    </Sets>
  </Requirements>

  <FormSettings>
    <Form xsi:type="ItemRead">
      <DesktopSettings>
        <SourceLocation DefaultValue="${appUrl}/taskpane.html"/>
        <RequestedHeight>450</RequestedHeight>
      </DesktopSettings>
    </Form>
  </FormSettings>

  <Permissions>ReadWriteMailbox</Permissions>
  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Read"/>
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Edit"/>
  </Rule>
  <DisableEntityHighlighting>false</DisableEntityHighlighting>

  <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
    <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides/1.1" xsi:type="VersionOverridesV1_1">

      <Requirements>
        <bt:Sets DefaultMinVersion="1.3">
          <bt:Set Name="Mailbox"/>
        </bt:Sets>
      </Requirements>

      <Hosts>
        <Host xsi:type="MailHost">
          <DesktopFormFactor>

            <FunctionFile resid="functionFile"/>

            <!-- Read Mode -->
            <ExtensionPoint xsi:type="MessageReadCommandSurface">
              <OfficeTab id="TabDefault">
                <Group id="msgReadGroup">
                  <Label resid="GroupLabel"/>
                  <Control xsi:type="Button" id="msgReadOpenPaneButton">
                    <Label resid="TaskpaneButton.Label"/>
                    <Supertip>
                      <Title resid="TaskpaneButton.Label"/>
                      <Description resid="TaskpaneButton.Tooltip"/>
                    </Supertip>
                    <Icon>
                      <bt:Image size="16" resid="Icon.16x16"/>
                      <bt:Image size="32" resid="Icon.32x32"/>
                      <bt:Image size="80" resid="Icon.80x80"/>
                    </Icon>
                    <Action xsi:type="ShowTaskpane">
                      <SourceLocation resid="Taskpane.Url"/>
                    </Action>
                  </Control>
                </Group>
              </OfficeTab>
            </ExtensionPoint>

            <!-- Compose Mode -->
            <ExtensionPoint xsi:type="MessageComposeCommandSurface">
              <OfficeTab id="TabDefault">
                <Group id="msgComposeGroup">
                  <Label resid="GroupLabel"/>
                  <Control xsi:type="Button" id="msgComposeOpenPaneButton">
                    <Label resid="TaskpaneButton.Label"/>
                    <Supertip>
                      <Title resid="TaskpaneButton.Label"/>
                      <Description resid="TaskpaneButton.Tooltip"/>
                    </Supertip>
                    <Icon>
                      <bt:Image size="16" resid="Icon.16x16"/>
                      <bt:Image size="32" resid="Icon.32x32"/>
                      <bt:Image size="80" resid="Icon.80x80"/>
                    </Icon>
                    <Action xsi:type="ShowTaskpane">
                      <SourceLocation resid="Taskpane.Url"/>
                    </Action>
                  </Control>
                </Group>
              </OfficeTab>
            </ExtensionPoint>

          </DesktopFormFactor>

          <!-- Mobile -->
          <MobileFormFactor>
            <FunctionFile resid="functionFile"/>
            <ExtensionPoint xsi:type="MobileMessageReadCommandSurface">
              <Group id="mobileMsgRead">
                <Label resid="GroupLabel"/>
                <Control xsi:type="MobileButton" id="mobileReadTaskPaneBtn">
                  <Label resid="TaskpaneButton.Label"/>
                  <Icon>
                    <bt:Image size="25" scale="1" resid="Icon.32x32"/>
                    <bt:Image size="25" scale="2" resid="Icon.32x32"/>
                    <bt:Image size="25" scale="3" resid="Icon.32x32"/>
                    <bt:Image size="32" scale="1" resid="Icon.32x32"/>
                    <bt:Image size="32" scale="2" resid="Icon.32x32"/>
                    <bt:Image size="32" scale="3" resid="Icon.32x32"/>
                    <bt:Image size="48" scale="1" resid="Icon.80x80"/>
                    <bt:Image size="48" scale="2" resid="Icon.80x80"/>
                    <bt:Image size="48" scale="3" resid="Icon.80x80"/>
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <SourceLocation resid="Taskpane.Url"/>
                  </Action>
                </Control>
              </Group>
            </ExtensionPoint>
          </MobileFormFactor>

        </Host>
      </Hosts>

      <Resources>
        <bt:Images>
          <bt:Image id="Icon.16x16" DefaultValue="${appUrl}/assets/icon-16.png"/>
          <bt:Image id="Icon.32x32" DefaultValue="${appUrl}/assets/icon-32.png"/>
          <bt:Image id="Icon.80x80" DefaultValue="${appUrl}/assets/icon-80.png"/>
        </bt:Images>
        <bt:Urls>
          <bt:Url id="functionFile" DefaultValue="${appUrl}/taskpane.html"/>
          <bt:Url id="Taskpane.Url" DefaultValue="${appUrl}/taskpane.html"/>
        </bt:Urls>
        <bt:ShortStrings>
          <bt:String id="GroupLabel" DefaultValue="Grand Azure Bot"/>
          <bt:String id="TaskpaneButton.Label" DefaultValue="Route Email"/>
        </bt:ShortStrings>
        <bt:LongStrings>
          <bt:String id="TaskpaneButton.Tooltip" DefaultValue="Open Grand Azure Bot to route and assign this email to a booking in the PMS"/>
        </bt:LongStrings>
      </Resources>

    </VersionOverrides>
  </VersionOverrides>

</OfficeApp>`;

  return new Response(manifest, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': 'attachment; filename="grand-azure-manifest.xml"',
    },
  });
}
