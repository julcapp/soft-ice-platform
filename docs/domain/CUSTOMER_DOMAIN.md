# Customer Domain

Document code: DOMAIN-CUSTOMER-001
Task: EPIC-300 / DOMAIN-001
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-06
Last updated: 2026-07-06
Scope: Documentation only

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_PRINCIPLES.md`
- `docs/architecture/DDD_LITE_ARCHITECTURE.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/api/EVENT_API.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/domain/ANALYTICS_EVENTS.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/crm_architecture.md`
- `docs/tasks/TASK_INDEX.md`

---

# 1. Purpose

Customer Domain describes the customer as a stable business subject of Soft ICE Platform.

The domain exists so the platform can:

- create one canonical customer identity across Mini App, Telegram Bot, website, CRM, vending terminal and future channels;
- connect anonymous activity, Telegram identity, phone, email and other aliases to one `customer_id`;
- store and expose safe customer profile attributes;
- preserve consent history and current consent status;
- manage Club Timofey membership status;
- manage trusted customer status;
- manage referral relationships;
- build customer activity history for CRM, support, analytics and personalization;
- provide customer context to Order, Payment, Discount, Bonus, Notification, Promotion and Analytics domains.

Core rule:

```text
Customer Domain owns the customer relationship.
CustomerID is the platform identity.
External identities are aliases.
Consent is auditable.
Club and trusted status are customer states, not money.
Other domains consume customer context through contracts.
```

Customer Domain must not calculate product price, apply discounts, accrue bonuses, mutate wallet balance, execute payment, change order lifecycle, send notifications directly or decide API route access.

---

# 2. DDD Lite Role

Customer Domain is a DDD Lite bounded context.

It is responsible for the customer model and the customer relationship lifecycle.

Architecture position:

```text
Entry channel
->
Authentication
->
Customer identity resolution
->
Customer aggregate
->
Consent, Club, Trust, Referral and Activity projections
->
Order / Payment / Bonus / Discount / Notification / CRM / Analytics
```

Customer Domain owns:

- `customer_id`;
- customer account lifecycle;
- customer profile;
- contact points and verification state;
- identity links such as Telegram ID, phone, email, VK ID and future OAuth IDs;
- consent status projection and consent references;
- Club Timofey membership state;
- trusted customer state;
- referral relationship state;
- customer activity timeline;
- customer domain events;
- customer audit metadata.

Customer Domain does not own:

- authentication credential verification;
- authorization permissions, roles and scopes;
- product catalog;
- product configuration;
- pricing;
- discount calculation;
- bonus balance and bonus lifecycle;
- wallet cash balance;
- payment settlement;
- order lifecycle;
- machine commands;
- notification delivery;
- analytics storage;
- CRM screen behavior.

---

# 3. Ubiquitous Language

| Term | Meaning |
|---|---|
| Customer | A person represented by a stable platform customer identity. |
| CustomerID | Canonical platform identifier, stored as `customer_id`. |
| Anonymous User | A browser, Mini App or landing visitor known only by `anonymous_user_id`. |
| Identity Link | Connection between `customer_id` and an external alias such as Telegram ID, phone or email. |
| Contact Point | Phone, email, Telegram chat or other channel used to contact the customer. |
| Consent | Auditable permission or refusal for a specific processing or communication purpose. |
| Club Member | Customer with active Club Timofey membership. |
| Trusted Customer | Customer that passed approved trust criteria and can be used as a trusted segment. |
| Referrer | Customer who invites another customer through an approved referral relationship. |
| Referred Customer | Customer who enters through a referral relationship. |
| Activity Timeline | Ordered customer-linked business facts used for support, CRM and analytics. |

Customer-facing UI should avoid forcing the word "registration" into purchase flows. The domain may use technical lifecycle names internally, but user journeys should use business language such as "Join Club Timofey", "Get bonuses" or "Continue".

---

# 4. Customer Aggregate

The main aggregate is `Customer`.

Minimal aggregate model:

```json
{
  "customer_id": "customer_01JZ0000000000000000000000",
  "status": "active",
  "profile": {
    "display_name": "Alexander",
    "first_name": "Alexander",
    "last_name": null,
    "birth_date": "1990-01-01",
    "language": "ru",
    "timezone": "Asia/Tomsk"
  },
  "contacts": [],
  "identity_links": [],
  "consent_summary": {},
  "club_status": "not_joined",
  "trust_status": "not_trusted",
  "referral_summary": {},
  "preferences": {},
  "activity_summary": {},
  "audit": {},
  "created_at": "2026-07-06T00:00:00Z",
  "updated_at": "2026-07-06T00:00:00Z"
}
```

Aggregate invariants:

- one customer has exactly one stable `customer_id`;
- `customer_id` is never replaced by Telegram ID, phone, email, VK ID or provider customer ID;
- a customer can have many identity links, but each active external alias can point to only one customer unless an explicit merge process is approved;
- profile attributes must be minimal and purpose-bound;
- consent history must not be overwritten by profile updates;
- club status and trusted status are separate from payment state, wallet balance and bonus balance;
- referral relationships must be auditable and protected from self-referral;
- activity history is append-only from accepted events and must not become a place for raw secrets or excessive personal data.

---

# 5. Customer Lifecycle

Customer lifecycle is the business lifecycle of the customer identity.

Lifecycle:

```text
anonymous
->
provisional
->
identified
->
active
|-> dormant -> active
|-> suspended -> active
|-> closed
```

Lifecycle states:

| State | Meaning | Terminal |
|---|---|---|
| `anonymous` | Visitor or session exists, but no Customer aggregate is required yet. | No |
| `provisional` | Customer aggregate exists from a channel entry or checkout context, but key identity evidence is incomplete. | No |
| `identified` | At least one trusted identity link is verified or accepted by an approved authentication flow. | No |
| `active` | Customer can participate in normal platform scenarios according to consent, authorization and domain rules. | No |
| `dormant` | Customer has no recent activity but remains valid for future reactivation. | No |
| `suspended` | Customer is temporarily restricted because of support, fraud, abuse or legal review. | No |
| `closed` | Customer account is closed for new business actions according to retention and legal policy. | Yes for new actions |

Lifecycle rules:

- `anonymous` activity may be linked later only with audit and provenance.
- `provisional` customer may place a fast purchase only when the Order, Payment and legal flow allow it.
- `identified` requires at least one accepted identity signal such as verified Telegram Mini App authentication, verified phone or another approved identity provider.
- `active` does not imply Club membership, trusted status, discount eligibility or payment eligibility.
- `dormant` is a customer relationship state, not a punishment.
- `suspended` must include actor, reason, source and review metadata.
- `closed` must preserve legally required audit and financial references.
- Reopening a closed customer requires a future approved policy and must not silently reuse deleted personal data.

Club status, trust status and referral status are separate state dimensions. They must not be encoded as replacements for the main customer lifecycle state.

---

# 6. Customer Roles

Customer Domain uses role-like business positions. These are not API authorization roles.

| Role | Meaning | Domain rule |
|---|---|---|
| `anonymous_visitor` | Person or browser session without a `customer_id`. | Can produce anonymous analytics and consent records when allowed. |
| `customer` | Person with a `customer_id`. | Canonical subject for orders, payments, loyalty and CRM history. |
| `identified_customer` | Customer with at least one verified or trusted identity link. | Can use scenarios that require identity confidence. |
| `club_member` | Customer with active Club Timofey status. | May be eligible for club benefits through Discount, Bonus or Promotion rules. |
| `trusted_customer` | Customer with approved trust status. | May be used as a trusted segment or support/VIP flag, but does not bypass Runtime rules. |
| `referrer` | Customer who invited another customer. | May qualify for referral rewards after approved qualifying events. |
| `referred_customer` | Customer who entered through an approved referral. | May qualify the referrer only once according to referral policy. |
| `support_subject` | Customer involved in a support case or operator action. | Requires audit and least-privilege CRM access. |

Authorization roles such as `role_customer`, `role_crm_operator` or `role_admin` belong to Authorization, not Customer Domain.

---

# 7. Customer Attributes

Customer attributes are divided by purpose and sensitivity.

## 7.1 Identity Attributes

| Field | Required | Notes |
|---|---:|---|
| `customer_id` | Yes | Canonical platform identity. |
| `status` | Yes | Customer lifecycle state. |
| `created_at` | Yes | Creation timestamp. |
| `updated_at` | Yes | Last aggregate update timestamp. |
| `source_channel` | Recommended | Initial channel such as `telegram_mini_app`, `web_app`, `terminal` or `crm`. |
| `anonymous_user_id` | Optional | Previous anonymous identity when linked with audit. |

## 7.2 Profile Attributes

| Field | Required | Notes |
|---|---:|---|
| `display_name` | Optional | Safe customer-facing name. |
| `first_name` | Optional | Personal data, collect only when needed. |
| `last_name` | Optional | Personal data, avoid for MVP unless needed. |
| `birth_date` | Optional | Required only for birthday scenarios after consent and policy approval. |
| `language` | Optional | Default communication language. |
| `timezone` | Optional | Needed for reminders, birthdays and local schedules. |

## 7.3 Contact Attributes

Contact point model:

```json
{
  "contact_id": "contact_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "type": "phone",
  "value_hash": "hash",
  "display_mask": "+7 *** *** ** 00",
  "status": "verified",
  "is_primary": true,
  "verified_at": "2026-07-06T00:00:00Z",
  "source": "mini_app"
}
```

Contact rules:

- raw phone and email values are sensitive and must not be placed in analytics payloads or general events;
- display masks may be used for support and UI;
- verification status must be explicit;
- a contact point can be primary only inside its contact type;
- deleting or changing a contact must preserve audit according to privacy and legal policy.

## 7.4 Preference Attributes

Preferences may include:

- preferred language;
- preferred notification channels;
- favorite product choices;
- default machine or location when approved;
- marketing topic preferences;
- accessibility or UI preferences.

Preference rules:

- preferences must not override consent;
- preferences must not calculate product eligibility or price;
- preferences may inform personalization only when consent and policy allow it.

---

# 8. Identity Links

Identity links connect the canonical customer to external identity systems.

Identity link model:

```json
{
  "identity_link_id": "identity_link_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "provider": "telegram",
  "external_subject_id": "telegram_user_123456789",
  "external_username": "utimoshi_user",
  "status": "linked",
  "verification_method": "telegram_init_data",
  "linked_at": "2026-07-06T00:00:00Z",
  "last_seen_at": "2026-07-06T00:00:00Z",
  "unlinked_at": null
}
```

Supported identity providers:

| Provider | Alias field | Notes |
|---|---|---|
| `telegram` | Telegram user ID | External alias verified through Telegram authentication flow. |
| `phone` | Phone number hash/reference | Verification belongs to approved phone verification flow. |
| `email` | Email hash/reference | Verification belongs to approved email verification flow. |
| `vk` | VK user ID | Future external alias. |
| `max` | MAX user ID | Future external alias. |
| `oauth` | Provider subject | Future identity provider alias. |
| `payment_provider` | Provider customer reference | Correlation only, not primary identity. |

Identity rules:

- external aliases must resolve to `customer_id` before internal business contracts use them;
- external usernames are mutable and must not be used as stable identity;
- raw credentials, tokens, Telegram init data, bot tokens and provider secrets are forbidden in Customer records;
- the same active external identity must not be linked to multiple customers without an explicit conflict state;
- identity conflict resolution must be auditable;
- merge operations must preserve both previous customer IDs as historical references;
- unlinking an identity must not delete historical order, payment, consent or audit records.

---

# 9. Telegram Identification

Telegram is an important customer entry channel, but Telegram identity is not the Customer aggregate.

Expected Telegram Mini App identity flow:

```text
Telegram Mini App opened
->
Authentication verifies Telegram init data
->
Authentication creates identity context
->
Customer Domain resolves or creates customer_id
->
Customer Domain links Telegram alias
->
Customer session uses customer_id
```

Telegram rules:

- Telegram init data must be verified server-side before it is trusted;
- Customer Domain consumes safe identity context, not raw Telegram credential material;
- Telegram user ID is stored as an external alias;
- Telegram username is optional display metadata and can change;
- Telegram chat ID, if used for messaging, is a notification/contact route and must respect consent and notification preferences;
- one Telegram identity should map to one active customer;
- if the same Telegram identity appears for another customer, the domain must enter conflict review instead of silently overwriting links;
- Telegram link events must not expose raw init data.

Telegram-related events may include:

- `Customers.IdentityLinked`;
- `Customers.TelegramIdentityLinked`;
- `IdentityLinked`;
- `TelegramIdentityLinked`.

The `Customers.*` names are Event API contract names. The shorter names already exist in analytics vocabulary and may be used by Analytics projections where documented.

---

# 10. Consent Boundary

Consent is an auditable legal and privacy boundary.

The detailed consent type and evidence model is defined in `docs/domain/CONSENT_MODEL.md`.

Customer Domain uses consent in two ways:

1. it links consent records to `customer_id`;
2. it exposes the current consent summary needed by other domains.

Customer Domain must not erase consent history.

Consent summary example:

```json
{
  "customer_id": "customer_01JZ0000000000000000000000",
  "current": {
    "personal_data_processing": "granted",
    "marketing_communications": "denied",
    "transactional_communications": "granted",
    "loyalty_terms_acceptance": "granted",
    "referral_program_terms": "granted"
  },
  "last_changed_at": "2026-07-06T00:00:00Z"
}
```

Consent types relevant to Customer Domain:

- `personal_data_processing`;
- `marketing_communications`;
- `transactional_communications`;
- `photo_processing`;
- `location_processing`;
- `loyalty_terms_acceptance`;
- `referral_program_terms`;
- `analytics_cookies`;
- `personalization_cookies`;
- `marketing_cookies`.

Consent rules:

- personal data processing requires an approved legal basis or explicit consent according to policy;
- Club Timofey membership requires `loyalty_terms_acceptance`;
- referral participation requires `referral_program_terms` when the program is active;
- marketing communication requires `marketing_communications`;
- transactional notifications must stay separate from marketing;
- revocation must stop new restricted processing after policy-defined propagation;
- consent version, source, channel and evidence must be preserved;
- anonymous consent can be linked to a customer only with provenance and audit;
- consent state must be checked before Notification, Analytics, Promotion or CRM uses restricted customer data.

---

# 11. Club Timofey Status

Club Timofey is the customer membership layer.

Customer Domain owns the customer-facing club membership status. Bonus Engine owns bonus rights. Discount Engine owns discount calculation. Promotion Engine will own campaign automation when introduced.

Club status lifecycle:

```text
not_joined
->
pending_terms
->
active
|-> paused -> active
|-> left
|-> blocked
```

Club statuses:

| Status | Meaning |
|---|---|
| `not_joined` | Customer is not a club member. |
| `pending_terms` | Customer started joining, but required terms or data are incomplete. |
| `active` | Customer accepted club terms and can receive club benefits through approved domains. |
| `paused` | Club participation is temporarily inactive. |
| `left` | Customer left the club. |
| `blocked` | Club participation is blocked by support, fraud or legal policy. |

Club membership model:

```json
{
  "club_membership_id": "club_member_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "status": "active",
  "joined_at": "2026-07-06T00:00:00Z",
  "terms_version": "2026-07-06.v1",
  "source_channel": "telegram_mini_app",
  "tier": "base",
  "paused_at": null,
  "left_at": null
}
```

Club rules:

- joining the club must be explicit;
- club terms version must be recorded;
- club status does not equal bonus balance;
- club status does not equal wallet balance;
- club status does not guarantee a discount unless Discount Engine accepts an eligible membership rule;
- club status does not guarantee a bonus accrual unless Bonus Engine accepts an accrual rule;
- leaving the club must not delete historical orders, payments, bonus history or consent evidence;
- blocked club status must include actor, reason and audit metadata.

---

# 12. Trusted Customer

Trusted customer is a customer status used for segmentation, support, discounts or future risk decisions.

Trusted customer status is not an authorization role and does not bypass Runtime business rules.

Trust status lifecycle:

```text
not_trusted
->
candidate
->
trusted
|-> under_review
|-> revoked
```

Trust statuses:

| Status | Meaning |
|---|---|
| `not_trusted` | Customer has no trusted status. |
| `candidate` | Customer has enough signals for evaluation. |
| `trusted` | Customer passed approved trust rules. |
| `under_review` | Customer trust status is being reviewed. |
| `revoked` | Trusted status was removed with an auditable reason. |

Possible trust signals:

- verified email;
- verified phone;
- linked Telegram identity;
- subscription or membership signal from approved channels;
- marketing consent when required by the specific trust rule;
- active Club Timofey membership;
- successful purchase history;
- absence of unresolved fraud or abuse flags;
- approved operator or Product Owner action.

The CRM architecture mentions a trust direction based on email, Telegram channel subscription, VK subscription, advertising consent and Club Timofey participation. Exact production criteria must be approved by the Product Owner before implementation.

Trusted customer model:

```json
{
  "trusted_status_id": "trusted_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "status": "trusted",
  "rule_id": "trusted_customer_default_2026",
  "rule_version": 1,
  "signals": [
    "verified_email",
    "telegram_linked",
    "club_active"
  ],
  "assigned_at": "2026-07-06T00:00:00Z",
  "assigned_by": "system",
  "review_after": null
}
```

Trusted customer rules:

- trusted status must be calculated or assigned through approved rules;
- every assignment, review and revocation must be auditable;
- trusted status can be used as input for Discount, CRM, Promotion or support workflows;
- Discount Engine decides trusted customer discount eligibility and amount;
- trusted status must not grant admin, CRM or machine permissions;
- trusted status must not allow bypassing payment, order, fraud or consent rules.

---

# 13. Referral Relationships

Referral relationships connect one customer who invited and one customer who was invited.

Customer Domain owns the relationship and qualification state. Bonus Engine or Promotion Engine owns reward execution.

Referral model:

```json
{
  "referral_id": "referral_01JZ0000000000000000000000",
  "inviter_customer_id": "customer_01JZ_INVITER",
  "invited_customer_id": "customer_01JZ_INVITED",
  "referral_code_id": "ref_code_01JZ0000000000000000000000",
  "status": "qualified",
  "source_channel": "telegram_bot",
  "opened_at": "2026-07-06T00:00:00Z",
  "linked_at": "2026-07-06T00:05:00Z",
  "qualified_at": "2026-07-06T00:20:00Z",
  "reward_reference_id": "bonus_entry_01JZ0000000000000000000000"
}
```

Referral lifecycle:

```text
code_created
->
opened
->
linked
->
qualified
->
reward_pending
->
rewarded
```

Failure and review states:

```text
opened / linked / qualified
->
cancelled

opened / linked / qualified
->
fraud_review
->
cancelled or qualified
```

Referral rules:

- self-referral is forbidden;
- one invited customer can have only one active inviter for the same referral program;
- referral code use must be idempotent;
- referral relationship must not be created solely from untrusted client-side data;
- referral qualification must be based on approved facts such as identity link, first paid order or campaign-specific condition;
- referral reward must not be issued by Customer Domain directly;
- duplicate reward for the same qualifying action is forbidden;
- referral loops and suspicious chains require fraud review;
- referral events must minimize personal data.

---

# 14. Activity History

Customer activity history is an ordered timeline of customer-linked facts.

Activity history helps:

- support understand what happened;
- CRM build customer views;
- analytics build funnels and retention views;
- notification and promotion systems avoid repeating irrelevant messages;
- future AI modules reason over safe customer context.

Activity event model:

```json
{
  "activity_id": "activity_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "event_name": "OrderCompleted",
  "source_domain": "order",
  "source_id": "order_01JZ0000000000000000000000",
  "occurred_at": "2026-07-06T00:00:00Z",
  "summary": "Customer completed an order",
  "metadata": {
    "channel": "telegram_mini_app",
    "machine_id": "machine_01JZ0000000000000000000000"
  }
}
```

Activity categories:

- entry and session activity;
- identity activity;
- consent activity;
- profile activity;
- club activity;
- trusted status activity;
- referral activity;
- order activity;
- payment activity;
- bonus activity;
- discount and promotion activity;
- notification preference and delivery activity;
- support and CRM activity.

Activity rules:

- activity history is built from accepted domain events and approved audit records;
- activity history must not replace source-of-truth domains;
- raw payment credentials, raw tokens, secrets and unnecessary personal data are forbidden;
- sensitive activity must be visible only through authorized CRM or support views;
- event replay may rebuild activity projections but must not resend messages, payments, rewards or machine commands.

---

# 15. Commands

Future Customer Runtime commands should be explicit and idempotent.

Recommended commands:

| Command | Purpose |
|---|---|
| `CreateCustomer` | Create a provisional or identified customer from an approved context. |
| `ResolveCustomerIdentity` | Find or create customer identity from safe identity context. |
| `LinkIdentity` | Link an external alias to `customer_id`. |
| `UnlinkIdentity` | Remove an active external alias while preserving history. |
| `UpdateCustomerProfile` | Update allowed profile attributes. |
| `VerifyContactPoint` | Mark a contact point verified after approved verification flow. |
| `RecordConsentReference` | Link consent record or update consent summary projection. |
| `JoinClubTimofey` | Start or complete Club Timofey membership. |
| `LeaveClubTimofey` | Mark customer as left the club. |
| `EvaluateTrustedCustomer` | Evaluate trust status using approved rule version. |
| `AssignTrustedCustomerStatus` | Assign trusted status through approved operator or system process. |
| `RevokeTrustedCustomerStatus` | Revoke trusted status with reason and audit. |
| `CreateReferralCode` | Create customer referral code or link token. |
| `LinkReferral` | Connect invited customer to inviter. |
| `QualifyReferral` | Mark referral as qualified after approved fact. |
| `RecordCustomerActivity` | Append approved activity projection record. |
| `MergeCustomers` | Merge duplicate customer identities through audited process. |
| `SuspendCustomer` | Restrict customer for review with reason. |
| `CloseCustomer` | Close customer for new business actions according to policy. |

Command rules:

- commands must include actor context, source channel and correlation ID when available;
- commands that may create side effects must include idempotency keys;
- CRM operator commands require operator identity, permission and reason;
- commands must not accept final price, bonus balance, wallet balance or order state from UI;
- rejected sensitive commands should be auditable.

---

# 16. Queries

Future Customer Runtime queries should expose safe read models.

Recommended queries:

| Query | Purpose |
|---|---|
| `GetCustomerProfile` | Read allowed customer profile fields. |
| `GetCustomerIdentityLinks` | Read linked identities visible to the caller. |
| `GetCustomerConsentSummary` | Read current consent projection. |
| `GetClubStatus` | Read Club Timofey membership state. |
| `GetTrustedCustomerStatus` | Read trusted status and safe reason metadata. |
| `GetReferralSummary` | Read inviter, invited and reward correlation summary. |
| `GetCustomerActivityTimeline` | Read authorized customer timeline. |
| `FindCustomerForSupport` | Search customer support view with audit. |
| `ResolveCustomerByExternalAlias` | Resolve external alias to `customer_id` inside trusted platform boundary. |

Query rules:

- customer self-service queries can return only the customer's own data;
- CRM queries require operator permissions and audit;
- analytics queries should use projections and minimized identifiers;
- queries must not expose raw tokens, secrets, provider payloads or payment credentials.

---

# 17. Customer Events

Customer Domain publishes events after accepted customer facts.

Event API names should use `<Domain>.<Fact>` format.

Recommended customer events:

| Event | Produced after | Meaning |
|---|---|---|
| `Customers.Created` | Customer aggregate created. | New customer identity exists. |
| `Customers.ProfileUpdated` | Profile update accepted. | Safe customer profile changed. |
| `Customers.IdentityLinked` | External alias linked. | Customer identity has new verified or accepted link. |
| `Customers.TelegramIdentityLinked` | Telegram alias linked. | Telegram user ID mapped to `customer_id`. |
| `Customers.ContactPointVerified` | Contact verification accepted. | Phone, email or channel contact verified. |
| `Customers.ConsentGranted` | Consent grant linked or accepted. | Customer consent status changed to granted. |
| `Customers.ConsentRevoked` | Consent revocation linked or accepted. | Customer consent status changed to revoked. |
| `Customers.ClubJoined` | Club membership became active. | Customer joined Club Timofey. |
| `Customers.ClubStatusChanged` | Club state changed. | Membership state changed. |
| `Customers.TrustedStatusChanged` | Trust state changed. | Trusted customer status changed. |
| `Customers.ReferralLinked` | Invited customer linked to inviter. | Referral relationship exists. |
| `Customers.ReferralQualified` | Referral qualification accepted. | Referral can trigger approved reward flow. |
| `Customers.ActivityRecorded` | Activity projection appended. | Customer timeline was updated. |
| `Customers.Merged` | Duplicate customer merge accepted. | Customer identities were merged with audit. |
| `Customers.Suspended` | Customer suspended. | Customer is restricted for review. |
| `Customers.Closed` | Customer closed. | Customer account closed for new actions. |

Event payload rules:

- include `customer_id`;
- include stable source references;
- include event version;
- include correlation ID and causation ID when available;
- minimize personal data;
- do not include raw phone, raw email, Telegram init data, access tokens, bot tokens, payment credentials or provider secrets;
- consumers must be idempotent.

Minimal event payload example:

```json
{
  "customer_id": "customer_01JZ0000000000000000000000",
  "from_state": "identified",
  "to_state": "active",
  "source_channel": "telegram_mini_app",
  "correlation_id": "corr_01JZ0000000000000000000000"
}
```

---

# 18. Business Rules

Customer business rules:

1. `customer_id` is the canonical platform identity.
2. External identities are aliases only.
3. Authentication verifies external credentials before Customer Domain trusts them.
4. Authorization decides route access, not customer business state.
5. Customer Domain must not store raw credentials, bot tokens, API keys or payment secrets.
6. Customer profile data must be minimal and purpose-bound.
7. Consent evidence must be preserved and versioned.
8. Marketing communication requires marketing consent.
9. Transactional communication is separate from marketing communication.
10. Club membership requires explicit customer action and accepted terms.
11. Club membership is not bonus balance and not wallet balance.
12. Trusted customer status is not an authorization role.
13. Trusted customer status cannot bypass payment, order, discount, fraud or consent rules.
14. Referral self-invitation is forbidden.
15. Referral rewards are executed by Bonus or Promotion domains, not Customer Domain.
16. Customer activity history is a projection and must not replace source domains.
17. Customer merge must be explicit, audited and reversible only through approved correction policy.
18. UI must not infer customer discount, bonus or payment eligibility from local state.
19. CRM operator changes require actor, permission, reason and audit.
20. Future AI modules may use customer context only through approved, minimized and consent-aware projections.

---

# 19. Relationships With Other Domains

| Domain | Relationship | Boundary |
|---|---|---|
| Authentication | Verifies external identity and produces safe identity context. | Authentication does not own customer profile or business status. |
| Authorization | Uses `customer_id` for route and resource access policy. | Authorization does not decide club, trust, discount or order validity. |
| Consent | Stores legal evidence and consent lifecycle. | Customer Domain links consent to `customer_id` and exposes summary projections. |
| Product Catalog | Products are shown to customers. | Product availability and catalog data stay in Product/Catalog domains. |
| Configuration | Customer choices become product configuration. | Customer Domain does not validate product configuration. |
| Pricing | Pricing may receive customer context. | Customer Domain does not calculate prices. |
| Discount | Discount may use club or trusted status as eligibility context. | Discount Engine calculates eligibility, stacking and payable amount. |
| Bonus | Bonus uses `customer_id` for accrual, reservation and redemption rights. | Bonus Engine owns bonus lifecycle and projection. |
| Wallet | Wallet uses `customer_id` for cash balance ownership. | Customer Domain does not mutate wallet balance. |
| Payment | Payment references `customer_id` for settlement and audit. | Payment Engine owns payment lifecycle and provider interaction. |
| Order | Order stores `customer_id` and immutable snapshots. | Order owns purchase lifecycle and does not mutate customer profile. |
| Machine | Machine may correlate fulfillment to customer order. | Machine Domain does not own customer identity. |
| Notification | Notification uses contact routes, consent and preferences. | Notification Engine owns message delivery and templates. |
| CRM | CRM consumes Customer, Order, Payment, Bonus and support projections. | CRM screens do not replace Customer Domain source records. |
| Analytics | Analytics consumes minimized customer-linked events. | Analytics must respect consent and privacy rules. |
| Promotion | Promotion targets customer segments and referral campaigns. | Promotion Engine owns campaign execution; Customer owns relationship context. |
| Event API | Customer events are published as immutable facts. | Event API transports facts and does not decide customer outcomes. |

---

# 20. Privacy and Security

Customer Domain contains personal data and must follow privacy-by-design.

Security rules:

- store stable platform IDs instead of using raw external aliases in internal contracts;
- store hashes or protected references for sensitive contact values where possible;
- never place raw phone, email, token, Telegram init data or payment credentials in events;
- limit CRM access by role, scope and audit;
- record actor, reason and source for sensitive operator changes;
- support consent revocation propagation;
- isolate customer support notes from general analytics payloads;
- minimize data in Notification and Analytics consumers;
- preserve required financial and order references even when customer profile data is restricted or closed;
- make suspicious identity, referral or trusted status changes observable for review.

Privacy rules:

- collect only what is needed for the scenario;
- do not require club participation for basic purchase unless Product Owner approves a future policy;
- do not enable marketing by default;
- keep transactional and marketing communication separate;
- make customer data export and deletion workflows future-ready;
- retain audit, order, payment and legal records according to approved retention policy.

---

# 21. Fraud and Abuse Controls

Customer-related fraud controls are required for identity, trust and referrals.

Controls:

- duplicate identity detection;
- identity link conflict state;
- rate limits for contact verification attempts;
- referral self-referral prevention;
- referral loop detection;
- duplicate referral reward prevention;
- suspicious referral velocity review;
- trusted status review and revocation;
- suspicious CRM operator action audit;
- customer suspension for review;
- event correlation across customer, order, payment, bonus and device signals where legally allowed.

Fraud review rules:

- review must not silently edit historical records;
- confirmed corrections use explicit compensating operations;
- customer suspension does not delete order, payment, consent or audit history;
- fraud signals must be minimized and protected.

---

# 22. Storage Direction

MVP implementation may start with in-memory or JSON-backed repositories where appropriate.

Future production storage should support PostgreSQL-backed Customer Runtime records.

Recommended storage groups:

- customers;
- customer profiles;
- contact points;
- identity links;
- consent references or projections;
- club memberships;
- trusted status records;
- referral codes;
- referral relationships;
- customer activity timeline;
- customer audit records;
- merge records;
- suspension and closure records.

Storage rules:

- repository interfaces should hide storage technology from UI;
- raw external provider payloads should not be stored in Customer Domain unless explicitly approved and protected;
- migrations must preserve `customer_id`;
- indexes should support identity resolution by external alias without exposing raw personal data broadly;
- read models for CRM and Analytics should be projections, not direct writes to source records.

---

# 23. Out of Scope

DOMAIN-001 does not include:

- JavaScript implementation;
- frontend changes;
- React component changes;
- routes or API implementation;
- database migrations;
- CRM screen implementation;
- Telegram Bot implementation;
- payment provider setup;
- notification templates;
- legal text drafting;
- final trusted customer scoring thresholds;
- final referral reward amounts;
- final club discount or bonus values.

Any final commercial terms for Club Timofey, trusted customer benefits, referral rewards or marketing programs require Product Owner approval.

---

# 24. Readiness Criteria

Customer Domain is architecture-ready when:

- Customer aggregate is documented;
- Customer lifecycle is documented;
- customer roles are documented;
- profile, contact and identity attributes are documented;
- consent boundary is documented;
- Club Timofey status is documented;
- trusted customer status is documented;
- Telegram identity rules are documented;
- referral relationship rules are documented;
- customer activity history is documented;
- commands and queries are documented;
- customer events are documented;
- business rules are documented;
- relationships with other domains are documented;
- privacy, security, fraud and storage directions are documented;
- no application source code is modified.

Implementation-ready criteria for future tasks:

- Customer command, query and event schemas are approved;
- consent storage and Customer summary projection contract are approved;
- identity merge policy is approved;
- Telegram identity linking contract is approved;
- Club Timofey terms and membership rules are approved;
- trusted customer criteria are approved by Product Owner;
- referral qualification and reward policy are approved;
- CRM operator permissions and audit requirements are approved;
- test scenarios are prepared for identity, consent, club, trust and referral flows.

---

# 25. Future Roadmap

Recommended future tasks:

1. Define Customer Runtime command contracts.
2. Define Customer Runtime query contracts.
3. Define Customer event payload schemas.
4. Define Customer repository and storage model.
5. Define Telegram identity linking implementation contract.
6. Define consent summary projection integration.
7. Define Club Timofey membership implementation.
8. Define trusted customer rule configuration.
9. Define referral code and referral relationship implementation.
10. Define Customer activity timeline projection.
11. Define CRM customer support read model.
12. Define privacy export, restriction and closure workflows.
13. Add test scenarios for customer lifecycle, consent, club, trust and referral flows.

---

# Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations, generated build output or commercial benefit values.
