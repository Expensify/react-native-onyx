/**
 * Data generators for Onyx benchmarks.
 *
 * Produces production-realistic mock data modeled after Expensify App's ONYXKEYS,
 * without importing from App to avoid pulling in the entire dependency tree.
 * Key strings are replicated verbatim so the shape of the Onyx store matches production.
 */

// ---------------------------------------------------------------------------
// ONYXKEYS (simplified mirror of App/src/ONYXKEYS.ts)
// ---------------------------------------------------------------------------

const ONYXKEYS = {
    // Scalar keys
    ACCOUNT: 'account',
    ACCOUNT_MANAGER_REPORT_ID: 'accountManagerReportID',
    ACTIVE_CLIENTS: 'activeClients',
    DEVICE_ID: 'deviceID',
    IS_SIDEBAR_LOADED: 'isSidebarLoaded',
    IS_SEARCHING_FOR_REPORTS: 'isSearchingForReports',
    PERSISTED_REQUESTS: 'networkRequestQueue',
    PERSISTED_ONGOING_REQUESTS: 'networkOngoingRequestQueue',
    CURRENT_DATE: 'currentDate',
    CREDENTIALS: 'credentials',
    STASHED_CREDENTIALS: 'stashedCredentials',
    MODAL: 'modal',
    NETWORK: 'network',
    PERSONAL_DETAILS_LIST: 'personalDetailsList',
    PRIVATE_PERSONAL_DETAILS: 'private_personalDetails',
    PERSONAL_DETAILS_METADATA: 'personalDetailsMetadata',
    SESSION: 'session',
    STASHED_SESSION: 'stashedSession',
    BETAS: 'betas',
    CURRENCY_LIST: 'currencyList',
    LOGIN_LIST: 'loginList',
    USER_WALLET: 'userWallet',
    BANK_ACCOUNT_LIST: 'bankAccountList',
    FUND_LIST: 'fundList',
    CARD_LIST: 'cardList',
    IS_LOADING_APP: 'isLoadingApp',
    HAS_LOADED_APP: 'hasLoadedApp',
    COUNTRY_CODE: 'countryCode',
    COUNTRY: 'country',
    PLAID_DATA: 'plaidData',
    PREFERRED_THEME: 'nvp_preferredTheme',
    NVP_PRIORITY_MODE: 'nvp_priorityMode',
    NVP_PREFERRED_LOCALE: 'nvp_preferredLocale',
    NVP_ONBOARDING: 'nvp_onboarding',
    NVP_QUICK_ACTION_GLOBAL_CREATE: 'nvp_quickActionGlobalCreate',
    NVP_TRAVEL_SETTINGS: 'nvp_travelSettings',
    PREFERRED_EMOJI_SKIN_TONE: 'nvp_expensify_preferredEmojiSkinTone',
    FREQUENTLY_USED_EMOJIS: 'nvp_expensify_frequentlyUsedEmojis',
    SAVED_SEARCHES: 'nvp_savedSearches',
    RECENT_SEARCHES: 'nvp_recentSearches',
    ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT: 'OnyxUpdatesLastUpdateIDAppliedToClient',
    LAST_VISITED_PATH: 'lastVisitedPath',
    RECENTLY_USED_REPORT_FIELDS: 'recentlyUsedReportFields',
    CONCIERGE_REPORT_ID: 'conciergeReportID',
    SELF_DM_REPORT_ID: 'selfDMReportID',
    MAPBOX_ACCESS_TOKEN: 'mapboxAccessToken',
    LAST_ACCESSED_WORKSPACE_POLICY_ID: 'lastAccessedWorkspacePolicyID',
    IS_LOADING_REPORT_DATA: 'isLoadingReportData',
    WALLET_TRANSFER: 'walletTransfer',
    CUSTOM_STATUS_DRAFT: 'customStatusDraft',

    // Collection keys
    COLLECTION: {
        REPORT: 'report_',
        REPORT_ACTIONS: 'reportActions_',
        REPORT_METADATA: 'reportMetadata_',
        REPORT_DRAFT_COMMENT: 'reportDraftComment_',
        REPORT_IS_COMPOSER_FULL_SIZE: 'reportIsComposerFullSize_',
        REPORT_USER_IS_TYPING: 'reportUserIsTyping_',
        REPORT_NAME_VALUE_PAIRS: 'reportNameValuePairs_',
        POLICY: 'policy_',
        POLICY_DRAFTS: 'policyDrafts_',
        POLICY_CATEGORIES: 'policyCategories_',
        POLICY_TAGS: 'policyTags_',
        POLICY_RECENTLY_USED_CATEGORIES: 'policyRecentlyUsedCategories_',
        POLICY_RECENTLY_USED_TAGS: 'nvp_recentlyUsedTags_',
        POLICY_CONNECTION_SYNC_PROGRESS: 'policyConnectionSyncProgress_',
        TRANSACTION: 'transactions_',
        TRANSACTION_VIOLATIONS: 'transactionViolations_',
        TRANSACTION_DRAFT: 'transactionsDraft_',
        TRANSACTION_BACKUP: 'transactionsBackup_',
        SECURITY_GROUP: 'securityGroup_',
        DOWNLOAD: 'download_',
        DOMAIN: 'domain_',
        NEXT_STEP: 'reportNextStep_',
        SNAPSHOT: 'snapshot_',
        WORKSPACE_CARDS_LIST: 'cards_',
        REPORT_ACTIONS_DRAFTS: 'reportActionsDrafts_',
        REPORT_ACTIONS_PAGES: 'reportActionsPages_',
        REPORT_ACTIONS_REACTIONS: 'reportActionsReactions_',
        REPORT_VIOLATIONS: 'reportViolations_',
        SELECTED_TAB: 'selectedTab_',
    },
} as const;

export {ONYXKEYS};

// ---------------------------------------------------------------------------
// Data tiers
// ---------------------------------------------------------------------------

export type DataTierName = 'small' | 'modest' | 'heavy' | 'extreme';

export interface DataTierConfig {
    reports: number;
    reportActions: number;
    transactions: number;
    policies: number;
    personalDetails: number;
}

export const DATA_TIERS: Record<DataTierName, DataTierConfig> = {
    small: {reports: 50, reportActions: 500, transactions: 50, policies: 1, personalDetails: 20},
    modest: {reports: 250, reportActions: 2500, transactions: 250, policies: 3, personalDetails: 100},
    heavy: {reports: 1000, reportActions: 10000, transactions: 1000, policies: 10, personalDetails: 500},
    extreme: {reports: 5000, reportActions: 50000, transactions: 5000, policies: 25, personalDetails: 2000},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _counter = 0;
function uid(): string {
    return String(++_counter);
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function isoDate(daysAgo = 0): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().replace('T', ' ').slice(0, 23);
}

const MERCHANTS = ['Uber', 'Starbucks', 'Amazon', 'Delta Airlines', 'Marriott', 'WeWork', 'Whole Foods', 'Shell Gas', 'FedEx', 'Apple Store'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const REPORT_TYPES = ['chat', 'expense', 'iou', 'task'];
const ACTION_NAMES = ['ADDCOMMENT', 'IOU', 'CREATED', 'CLOSED', 'REPORTPREVIEW', 'MARKEDREIMBURSED', 'MODIFIEDEXPENSE'];

// ---------------------------------------------------------------------------
// Entity generators
// ---------------------------------------------------------------------------

export interface MockReport {
    reportID: string;
    reportName: string;
    type: string;
    stateNum: number;
    statusNum: number;
    ownerAccountID: number;
    managerID: number;
    currency: string;
    total: number;
    nonReimbursableTotal: number;
    lastVisibleActionCreated: string;
    lastReadTime: string;
    lastMessageText: string;
    participantAccountIDs: number[];
    participants: Record<string, {notificationPreference: string}>;
    isPinned: boolean;
    chatType: string;
    policyID: string;
    isOwnPolicyExpenseChat: boolean;
    hasOutstandingChildRequest: boolean;
    description: string;
}

export function generateReport(id: number, policyID: string): MockReport {
    const reportID = String(id);
    const ownerAccountID = randomInt(1, 200);
    const participantCount = randomInt(1, 5);
    const participantAccountIDs = Array.from({length: participantCount}, (_, i) => ownerAccountID + i + 1);
    const participants: Record<string, {notificationPreference: string}> = {};
    for (const pid of participantAccountIDs) {
        participants[String(pid)] = {notificationPreference: 'always'};
    }

    return {
        reportID,
        reportName: `Report #${reportID}`,
        type: randomChoice(REPORT_TYPES),
        stateNum: randomInt(0, 2),
        statusNum: randomInt(0, 4),
        ownerAccountID,
        managerID: randomInt(1, 200),
        currency: randomChoice(CURRENCIES),
        total: randomInt(100, 100000),
        nonReimbursableTotal: randomInt(0, 5000),
        lastVisibleActionCreated: isoDate(randomInt(0, 90)),
        lastReadTime: isoDate(randomInt(0, 30)),
        lastMessageText: `This is a sample message for report ${reportID}`,
        participantAccountIDs,
        participants,
        isPinned: Math.random() < 0.1,
        chatType: 'policyExpenseChat',
        policyID,
        isOwnPolicyExpenseChat: Math.random() < 0.3,
        hasOutstandingChildRequest: Math.random() < 0.2,
        description: '',
    };
}

export interface MockReportAction {
    reportActionID: string;
    actionName: string;
    actorAccountID: number;
    created: string;
    message: Array<{type: string; html: string; text: string; isEdited: boolean}>;
    originalMessage: {html: string; lastModified: string};
    person: Array<{type: string; style: string; text: string}>;
    avatar: string;
    automatic: boolean;
    shouldShow: boolean;
    lastModified: string;
    pendingAction: string | null;
    errors: Record<string, never>;
}

export function generateReportAction(index: number): MockReportAction {
    const actorAccountID = randomInt(1, 200);
    return {
        reportActionID: String(index),
        actionName: randomChoice(ACTION_NAMES),
        actorAccountID,
        created: isoDate(randomInt(0, 90)),
        message: [
            {
                type: 'COMMENT',
                html: `<p>Message body ${index}</p>`,
                text: `Message body ${index}`,
                isEdited: Math.random() < 0.1,
            },
        ],
        originalMessage: {
            html: `<p>Original message ${index}</p>`,
            lastModified: isoDate(randomInt(0, 90)),
        },
        person: [{type: 'TEXT', style: 'strong', text: `User ${actorAccountID}`}],
        avatar: `https://d2k5nsl2zxldvw.cloudfront.net/images/avatars/avatar_${actorAccountID % 8}.png`,
        automatic: false,
        shouldShow: true,
        lastModified: isoDate(randomInt(0, 30)),
        pendingAction: null,
        errors: {},
    };
}

export interface MockTransaction {
    transactionID: string;
    amount: number;
    merchant: string;
    currency: string;
    created: string;
    modifiedCreated: string;
    comment: {comment: string};
    category: string;
    tag: string;
    reportID: string;
    receipt: Record<string, never>;
    filename: string;
    billable: boolean;
    reimbursable: boolean;
    pendingAction: string | null;
    errors: Record<string, never>;
    cardID: number;
    originalAmount: number;
    originalCurrency: string;
}

export function generateTransaction(id: number, reportID: string): MockTransaction {
    const currency = randomChoice(CURRENCIES);
    const amount = randomInt(100, 50000);
    return {
        transactionID: String(id),
        amount,
        merchant: randomChoice(MERCHANTS),
        currency,
        created: isoDate(randomInt(0, 90)),
        modifiedCreated: '',
        comment: {comment: `Expense note ${id}`},
        category: randomChoice(['Travel', 'Meals', 'Office', 'Software', 'Transport', '']),
        tag: randomChoice(['Project A', 'Project B', 'General', '']),
        reportID,
        receipt: {},
        filename: '',
        billable: Math.random() < 0.3,
        reimbursable: Math.random() < 0.7,
        pendingAction: null,
        errors: {},
        cardID: randomInt(0, 5),
        originalAmount: amount,
        originalCurrency: currency,
    };
}

export interface MockPolicy {
    id: string;
    name: string;
    type: string;
    role: string;
    owner: string;
    ownerAccountID: number;
    outputCurrency: string;
    isPolicyExpenseChatEnabled: boolean;
    autoReporting: boolean;
    autoReportingFrequency: string;
    harvesting: {enabled: boolean};
    defaultBillable: boolean;
    disabledFields: {defaultBillable: boolean};
    customUnits: Record<string, unknown>;
    areCategoriesEnabled: boolean;
    areTagsEnabled: boolean;
    areDistanceRatesEnabled: boolean;
    areWorkflowsEnabled: boolean;
    areReportFieldsEnabled: boolean;
    areConnectionsEnabled: boolean;
    employeeList: Record<string, {email: string; role: string}>;
}

export function generatePolicy(id: number, memberCount = 10): MockPolicy {
    const policyID = String(id);
    const employeeList: Record<string, {email: string; role: string}> = {};
    for (let i = 0; i < memberCount; i++) {
        const email = `user${i}@company${id}.com`;
        employeeList[email] = {email, role: i === 0 ? 'admin' : 'user'};
    }
    return {
        id: policyID,
        name: `Workspace ${policyID}`,
        type: 'team',
        role: 'admin',
        owner: `admin@company${id}.com`,
        ownerAccountID: randomInt(1, 200),
        outputCurrency: 'USD',
        isPolicyExpenseChatEnabled: true,
        autoReporting: true,
        autoReportingFrequency: 'immediate',
        harvesting: {enabled: true},
        defaultBillable: false,
        disabledFields: {defaultBillable: true},
        customUnits: {},
        areCategoriesEnabled: true,
        areTagsEnabled: true,
        areDistanceRatesEnabled: false,
        areWorkflowsEnabled: true,
        areReportFieldsEnabled: false,
        areConnectionsEnabled: false,
        employeeList,
    };
}

export interface MockPersonalDetails {
    accountID: number;
    displayName: string;
    firstName: string;
    lastName: string;
    login: string;
    avatar: string;
    pronouns: string;
    timezone: {selected: string; automatic: boolean};
    phoneNumber: string;
    validated: boolean;
}

export function generatePersonalDetails(accountID: number): MockPersonalDetails {
    const firstName = randomChoice(FIRST_NAMES);
    const lastName = randomChoice(LAST_NAMES);
    return {
        accountID,
        displayName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        login: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${accountID}@example.com`,
        avatar: `https://d2k5nsl2zxldvw.cloudfront.net/images/avatars/avatar_${accountID % 8}.png`,
        pronouns: '',
        timezone: {selected: 'America/New_York', automatic: true},
        phoneNumber: `+1${String(randomInt(2000000000, 9999999999))}`,
        validated: true,
    };
}

// ---------------------------------------------------------------------------
// Scalar keys generator
// ---------------------------------------------------------------------------

function generateScalarKeys(): Record<string, unknown> {
    return {
        [ONYXKEYS.ACCOUNT]: {
            accountID: 12345,
            email: 'user@example.com',
            validated: true,
            requiresTwoFactorAuth: false,
            isLoading: false,
        },
        [ONYXKEYS.SESSION]: {
            authToken: 'mock-auth-token-abcdef123456',
            accountID: 12345,
            email: 'user@example.com',
            encryptedAuthToken: 'mock-encrypted-token',
            autoAuthState: 'authenticated',
        },
        [ONYXKEYS.CREDENTIALS]: {
            login: 'user@example.com',
            autoGeneratedLogin: 'user-auto-12345',
            autoGeneratedPassword: 'mock-password-hash',
        },
        [ONYXKEYS.NETWORK]: {isOffline: false, shouldForceOffline: false},
        [ONYXKEYS.BETAS]: ['all'],
        [ONYXKEYS.IS_SIDEBAR_LOADED]: true,
        [ONYXKEYS.IS_LOADING_APP]: false,
        [ONYXKEYS.HAS_LOADED_APP]: true,
        [ONYXKEYS.CURRENT_DATE]: new Date().toISOString().slice(0, 10),
        [ONYXKEYS.PREFERRED_THEME]: 'system',
        [ONYXKEYS.NVP_PREFERRED_LOCALE]: 'en',
        [ONYXKEYS.NVP_PRIORITY_MODE]: 'default',
        [ONYXKEYS.COUNTRY_CODE]: 1,
        [ONYXKEYS.COUNTRY]: 'US',
        [ONYXKEYS.DEVICE_ID]: 'mock-device-id-abcdef',
        [ONYXKEYS.ACTIVE_CLIENTS]: ['client-1'],
        [ONYXKEYS.MODAL]: {isVisible: false, willAlertModalBecomeVisible: false},
        [ONYXKEYS.PERSISTED_REQUESTS]: [],
        [ONYXKEYS.CONCIERGE_REPORT_ID]: '1',
        [ONYXKEYS.SELF_DM_REPORT_ID]: '2',
        [ONYXKEYS.LAST_VISITED_PATH]: '/home',
        [ONYXKEYS.MAPBOX_ACCESS_TOKEN]: {token: 'mock-mapbox-token'},
        [ONYXKEYS.PREFERRED_EMOJI_SKIN_TONE]: 0,
        [ONYXKEYS.FREQUENTLY_USED_EMOJIS]: [
            {code: '👍', count: 42, lastUpdatedAt: Date.now()},
            {code: '😂', count: 30, lastUpdatedAt: Date.now()},
        ],
        [ONYXKEYS.RECENTLY_USED_REPORT_FIELDS]: {},
        [ONYXKEYS.SAVED_SEARCHES]: {},
        [ONYXKEYS.RECENT_SEARCHES]: [],
        [ONYXKEYS.LOGIN_LIST]: {
            'user@example.com': {partnerUserID: 'user@example.com', validatedDate: isoDate(30)},
        },
        [ONYXKEYS.BANK_ACCOUNT_LIST]: {},
        [ONYXKEYS.FUND_LIST]: {},
        [ONYXKEYS.CARD_LIST]: {},
        [ONYXKEYS.USER_WALLET]: {currentBalance: 0},
        [ONYXKEYS.WALLET_TRANSFER]: {},
        [ONYXKEYS.CURRENCY_LIST]: generateCurrencyList(),
        [ONYXKEYS.IS_LOADING_REPORT_DATA]: false,
        [ONYXKEYS.ONYX_UPDATES_LAST_UPDATE_ID_APPLIED_TO_CLIENT]: randomInt(100000, 999999),
    };
}

function generateCurrencyList(): Record<string, {symbol: string; name: string; ISO4217: string}> {
    const list: Record<string, {symbol: string; name: string; ISO4217: string}> = {};
    const entries: Array<[string, string, string]> = [
        ['USD', '$', 'US Dollar'],
        ['EUR', '€', 'Euro'],
        ['GBP', '£', 'British Pound'],
        ['CAD', 'CA$', 'Canadian Dollar'],
        ['AUD', 'A$', 'Australian Dollar'],
        ['JPY', '¥', 'Japanese Yen'],
    ];
    for (const [iso, symbol, name] of entries) {
        list[iso] = {symbol, name, ISO4217: iso};
    }
    return list;
}

// ---------------------------------------------------------------------------
// Full store generator
// ---------------------------------------------------------------------------

export interface GeneratedStore {
    /** Flat key→value map ready to be passed to Onyx.multiSet */
    data: Record<string, unknown>;
    /** Metadata about what was generated */
    meta: {
        tier: DataTierName | 'custom';
        config: DataTierConfig;
        reportIDs: string[];
        transactionIDs: string[];
        policyIDs: string[];
        totalKeys: number;
    };
}

export function generateFullStore(tierOrConfig: DataTierName | DataTierConfig): GeneratedStore {
    const tierName: DataTierName | 'custom' = typeof tierOrConfig === 'string' ? tierOrConfig : 'custom';
    const config: DataTierConfig = typeof tierOrConfig === 'string' ? DATA_TIERS[tierOrConfig] : tierOrConfig;

    _counter = 0; // reset uid counter for deterministic IDs
    const data: Record<string, unknown> = {};

    // 1. Scalar keys
    Object.assign(data, generateScalarKeys());

    // 2. Policies
    const policyIDs: string[] = [];
    for (let i = 0; i < config.policies; i++) {
        const policy = generatePolicy(i + 1, Math.min(config.personalDetails, 50));
        policyIDs.push(policy.id);
        data[`${ONYXKEYS.COLLECTION.POLICY}${policy.id}`] = policy;
    }

    // 3. Reports
    const reportIDs: string[] = [];
    for (let i = 0; i < config.reports; i++) {
        const policyID = policyIDs[i % policyIDs.length];
        const report = generateReport(i + 1, policyID);
        reportIDs.push(report.reportID);
        data[`${ONYXKEYS.COLLECTION.REPORT}${report.reportID}`] = report;
        data[`${ONYXKEYS.COLLECTION.REPORT_METADATA}${report.reportID}`] = {
            isLoadingInitialReportActions: false,
            isLoadingOlderReportActions: false,
            isLoadingNewerReportActions: false,
        };
    }

    // 4. Report Actions (spread across reports)
    for (let i = 0; i < config.reportActions; i++) {
        const reportID = reportIDs[i % reportIDs.length];
        const action = generateReportAction(i + 1);
        // Report actions are stored as a single object per reportID containing all actions
        const key = `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportID}`;
        if (!data[key]) {
            data[key] = {};
        }
        (data[key] as Record<string, MockReportAction>)[action.reportActionID] = action;
    }

    // 5. Transactions
    const transactionIDs: string[] = [];
    for (let i = 0; i < config.transactions; i++) {
        const reportID = reportIDs[i % reportIDs.length];
        const txn = generateTransaction(i + 1, reportID);
        transactionIDs.push(txn.transactionID);
        data[`${ONYXKEYS.COLLECTION.TRANSACTION}${txn.transactionID}`] = txn;
    }

    // 6. Personal Details (stored as a single map)
    const personalDetailsList: Record<string, MockPersonalDetails> = {};
    for (let i = 0; i < config.personalDetails; i++) {
        const pd = generatePersonalDetails(i + 1);
        personalDetailsList[String(pd.accountID)] = pd;
    }
    data[ONYXKEYS.PERSONAL_DETAILS_LIST] = personalDetailsList;

    return {
        data,
        meta: {
            tier: tierName,
            config,
            reportIDs,
            transactionIDs,
            policyIDs,
            totalKeys: Object.keys(data).length,
        },
    };
}
