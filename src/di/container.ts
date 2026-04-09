/**
 * DI Container - Composition Root
 *
 * Factory functions that wire port interfaces to concrete infrastructure adapters.
 * Repositories use lazy singleton pattern (one instance per Supabase client).
 * Use cases are created fresh per call (stateless).
 *
 * AI gateways (OCR, Classifier, Explanation, Verifier, VariantGenerator) require
 * server-side API keys and are NOT available in the client bundle.
 * Use cases that depend on AI gateways are marked "Edge Function only".
 */

import { supabase } from '@/infrastructure/api/supabaseClient';

// --- Repositories ---
import {
  SupabaseUserRepository,
  SupabaseExamRepository,
  SupabaseQuestionRepository,
  SupabaseCreditRepository,
  SupabaseBlueprintRepository,
  SupabaseCacheRepository,
  SupabaseDiagnosisRepository,
  SupabaseVariantRepository,
  SupabaseMiniTestRepository,
  SupabaseMiniTestAnswerRepository,
  SupabaseNotificationRepository,
  SupabaseSubscriptionRepository,
  SupabaseFollowRepository,
  SupabaseSharedItemRepository,
  SupabaseParentLinkRepository,
  SupabaseFeedbackRepository,
} from '@/infrastructure/repositories';

// --- Gateways (client-safe) ---
import { SupabaseStorageGateway } from '@/infrastructure/gateways/storage/SupabaseStorageGateway';

// --- Use Cases: Exam ---
import { UploadExamUseCase } from '@/usecases/exam/UploadExamUseCase';
import { VerifyQuestionsUseCase } from '@/usecases/exam/VerifyQuestionsUseCase';
import { GetExamDetailUseCase } from '@/usecases/exam/GetExamDetailUseCase';

// --- Use Cases: Diagnosis ---
import { GetDiagnosisUseCase } from '@/usecases/diagnosis/GetDiagnosisUseCase';

// --- Use Cases: Mini Test ---
import { CreateMiniTestUseCase } from '@/usecases/minitest/CreateMiniTestUseCase';
import { SubmitAnswersUseCase } from '@/usecases/minitest/SubmitAnswersUseCase';
import { GetResultsUseCase } from '@/usecases/minitest/GetResultsUseCase';
import { GetMiniTestDetailUseCase } from '@/usecases/minitest/GetMiniTestDetailUseCase';

// --- Use Cases: Payment ---
import { CheckCreditsUseCase } from '@/usecases/payment/CheckCreditsUseCase';

// --- Use Cases: Social ---
import { FollowUserUseCase } from '@/usecases/social/FollowUserUseCase';
import { RespondToFollowUseCase } from '@/usecases/social/RespondToFollowUseCase';
import { SearchUsersUseCase } from '@/usecases/social/SearchUsersUseCase';
import { ShareItemUseCase } from '@/usecases/social/ShareItemUseCase';
import { GetFeedUseCase } from '@/usecases/social/GetFeedUseCase';
import { GetPendingFollowsUseCase } from '@/usecases/social/GetPendingFollowsUseCase';

// --- Use Cases: Parent ---
import { GenerateLinkCodeUseCase } from '@/usecases/parent/GenerateLinkCodeUseCase';
import { LinkParentUseCase } from '@/usecases/parent/LinkParentUseCase';
import { UnlinkParentUseCase } from '@/usecases/parent/UnlinkParentUseCase';
import { GetDashboardUseCase } from '@/usecases/parent/GetDashboardUseCase';
import { GetActiveChildrenUseCase } from '@/usecases/parent/GetActiveChildrenUseCase';

// --- Use Cases: Common ---
import { GetNotificationsUseCase } from '@/usecases/common/GetNotificationsUseCase';
import { MarkNotificationReadUseCase } from '@/usecases/common/MarkNotificationReadUseCase';
import { SubmitFeedbackUseCase } from '@/usecases/common/SubmitFeedbackUseCase';
import { UpdateUserProfileUseCase } from '@/usecases/common/UpdateUserProfileUseCase';
import { GetMyPageDataUseCase } from '@/usecases/common/GetMyPageDataUseCase';

// =============================================================================
// Repository Singletons (lazy initialization)
// =============================================================================

let _userRepo: SupabaseUserRepository | null = null;
function getUserRepo() {
  if (!_userRepo) _userRepo = new SupabaseUserRepository(supabase);
  return _userRepo;
}

let _examRepo: SupabaseExamRepository | null = null;
function getExamRepo() {
  if (!_examRepo) _examRepo = new SupabaseExamRepository(supabase);
  return _examRepo;
}

let _questionRepo: SupabaseQuestionRepository | null = null;
function getQuestionRepo() {
  if (!_questionRepo) _questionRepo = new SupabaseQuestionRepository(supabase);
  return _questionRepo;
}

let _creditRepo: SupabaseCreditRepository | null = null;
function getCreditRepo() {
  if (!_creditRepo) _creditRepo = new SupabaseCreditRepository(supabase);
  return _creditRepo;
}

let _blueprintRepo: SupabaseBlueprintRepository | null = null;
function getBlueprintRepo() {
  if (!_blueprintRepo) _blueprintRepo = new SupabaseBlueprintRepository(supabase);
  return _blueprintRepo;
}

let _cacheRepo: SupabaseCacheRepository | null = null;
function getCacheRepo() {
  if (!_cacheRepo) _cacheRepo = new SupabaseCacheRepository(supabase);
  return _cacheRepo;
}

let _diagnosisRepo: SupabaseDiagnosisRepository | null = null;
function getDiagnosisRepo() {
  if (!_diagnosisRepo) _diagnosisRepo = new SupabaseDiagnosisRepository(supabase);
  return _diagnosisRepo;
}

let _variantRepo: SupabaseVariantRepository | null = null;
function getVariantRepo() {
  if (!_variantRepo) _variantRepo = new SupabaseVariantRepository(supabase);
  return _variantRepo;
}

let _miniTestRepo: SupabaseMiniTestRepository | null = null;
function getMiniTestRepo() {
  if (!_miniTestRepo) _miniTestRepo = new SupabaseMiniTestRepository(supabase);
  return _miniTestRepo;
}

let _miniTestAnswerRepo: SupabaseMiniTestAnswerRepository | null = null;
function getMiniTestAnswerRepo() {
  if (!_miniTestAnswerRepo) _miniTestAnswerRepo = new SupabaseMiniTestAnswerRepository(supabase);
  return _miniTestAnswerRepo;
}

let _notificationRepo: SupabaseNotificationRepository | null = null;
function getNotificationRepo() {
  if (!_notificationRepo) _notificationRepo = new SupabaseNotificationRepository(supabase);
  return _notificationRepo;
}

let _subscriptionRepo: SupabaseSubscriptionRepository | null = null;
function getSubscriptionRepo() {
  if (!_subscriptionRepo) _subscriptionRepo = new SupabaseSubscriptionRepository(supabase);
  return _subscriptionRepo;
}

let _followRepo: SupabaseFollowRepository | null = null;
function getFollowRepo() {
  if (!_followRepo) _followRepo = new SupabaseFollowRepository(supabase);
  return _followRepo;
}

let _sharedItemRepo: SupabaseSharedItemRepository | null = null;
function getSharedItemRepo() {
  if (!_sharedItemRepo) _sharedItemRepo = new SupabaseSharedItemRepository(supabase);
  return _sharedItemRepo;
}

let _parentLinkRepo: SupabaseParentLinkRepository | null = null;
function getParentLinkRepo() {
  if (!_parentLinkRepo) _parentLinkRepo = new SupabaseParentLinkRepository(supabase);
  return _parentLinkRepo;
}

let _feedbackRepo: SupabaseFeedbackRepository | null = null;
function getFeedbackRepo() {
  if (!_feedbackRepo) _feedbackRepo = new SupabaseFeedbackRepository(supabase);
  return _feedbackRepo;
}

// =============================================================================
// Gateway Singletons (client-safe only)
// =============================================================================

let _storageGateway: SupabaseStorageGateway | null = null;
function getStorageGateway() {
  if (!_storageGateway) _storageGateway = new SupabaseStorageGateway(supabase);
  return _storageGateway;
}

// =============================================================================
// UseCase Factory Functions
// =============================================================================

// ---------------------------------------------------------------------------
// Exam
// ---------------------------------------------------------------------------

/** Upload exam image, deduct credit, create exam record. */
export function createUploadExamUseCase() {
  return new UploadExamUseCase(
    getExamRepo(),
    getCreditRepo(),
    getStorageGateway(),
  );
}

// Edge Function only — requires IOcrGateway, IStorageGateway (server-signed URLs)
// export function createRunOcrUseCase() { ... }

/** Verify/correct OCR-extracted questions and mark exam as verified. */
export function createVerifyQuestionsUseCase() {
  return new VerifyQuestionsUseCase(
    getExamRepo(),
    getQuestionRepo(),
  );
}

/** Get exam detail with ownership verification. */
export function createGetExamDetailUseCase() {
  return new GetExamDetailUseCase(
    getExamRepo(),
  );
}

// Edge Function only — requires IClassifierGateway, IExplanationGateway,
// IVerifierGateway, IVariantGeneratorGateway
// export function createAnalyzeExamUseCase() { ... }

// Edge Function only — requires IVariantGeneratorGateway
// export function createGenerateVariantsUseCase() { ... }

// Edge Function only — requires IVariantGeneratorGateway
// export function createGenerateByTopicUseCase() { ... }

// ---------------------------------------------------------------------------
// Diagnosis
// ---------------------------------------------------------------------------

/** Retrieve enriched diagnosis results for an analyzed exam. */
export function createGetDiagnosisUseCase() {
  return new GetDiagnosisUseCase(
    getExamRepo(),
    getQuestionRepo(),
    getDiagnosisRepo(),
    getVariantRepo(),
    getBlueprintRepo(),
  );
}

// ---------------------------------------------------------------------------
// Mini Test
// ---------------------------------------------------------------------------

/** Create a mini test from selected variant questions. */
export function createCreateMiniTestUseCase() {
  return new CreateMiniTestUseCase(
    getMiniTestRepo(),
    getVariantRepo(),
  );
}

/** Submit answers, auto-score, and notify parent if linked. */
export function createSubmitAnswersUseCase() {
  return new SubmitAnswersUseCase(
    getMiniTestRepo(),
    getMiniTestAnswerRepo(),
    getVariantRepo(),
    getNotificationRepo(),
    getParentLinkRepo(),
  );
}

/** Get mini test results with enriched answer data. */
export function createGetResultsUseCase() {
  return new GetResultsUseCase(
    getMiniTestRepo(),
    getMiniTestAnswerRepo(),
    getVariantRepo(),
  );
}

/** Load mini test with ordered variant questions for solving. */
export function createGetMiniTestDetailUseCase() {
  return new GetMiniTestDetailUseCase(
    getMiniTestRepo(),
    getVariantRepo(),
  );
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

/** Check current credit balance and trigger reset if due. */
export function createCheckCreditsUseCase() {
  return new CheckCreditsUseCase(
    getCreditRepo(),
  );
}

// Edge Function only — requires IPaymentGateway (PortOne server-side keys)
// export function createCreateSubscriptionUseCase() { ... }

// Edge Function only — requires IPaymentGateway (webhook verification)
// export function createProcessWebhookUseCase() { ... }

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

/** Send a follow request to another user. */
export function createFollowUserUseCase() {
  return new FollowUserUseCase(
    getFollowRepo(),
    getUserRepo(),
    getNotificationRepo(),
  );
}

/** Accept, reject, or block a pending follow request. */
export function createRespondToFollowUseCase() {
  return new RespondToFollowUseCase(
    getFollowRepo(),
    getNotificationRepo(),
  );
}

/** Search users by nickname with follow status enrichment. */
export function createSearchUsersUseCase() {
  return new SearchUsersUseCase(
    getUserRepo(),
    getFollowRepo(),
  );
}

/** Share an AI-generated item (variant set, error note, etc.) to followers. */
export function createShareItemUseCase() {
  return new ShareItemUseCase(
    getSharedItemRepo(),
    getFollowRepo(),
    getNotificationRepo(),
  );
}

/** Get social feed of shared items from followed users. */
export function createGetFeedUseCase() {
  return new GetFeedUseCase(
    getSharedItemRepo(),
  );
}

/** Fetch pending follow requests for the current user, with follower nicknames resolved. */
export function createGetPendingFollowsUseCase() {
  return new GetPendingFollowsUseCase(
    getFollowRepo(),
    getUserRepo(),
  );
}

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

/** Generate a 6-character link code for parent-child connection. */
export function createGenerateLinkCodeUseCase() {
  return new GenerateLinkCodeUseCase(
    getUserRepo(),
    getParentLinkRepo(),
  );
}

/** Parent claims a link code to connect with child account. */
export function createLinkParentUseCase() {
  return new LinkParentUseCase(
    getUserRepo(),
    getParentLinkRepo(),
    getNotificationRepo(),
  );
}

/** Revoke an active parent-child link (either party can initiate). */
export function createUnlinkParentUseCase() {
  return new UnlinkParentUseCase(
    getParentLinkRepo(),
    getNotificationRepo(),
  );
}

/** Parent dashboard: aggregate child stats with privacy filter. */
export function createGetDashboardUseCase() {
  return new GetDashboardUseCase(
    getParentLinkRepo(),
    getUserRepo(),
    getMiniTestRepo(),
    getMiniTestAnswerRepo(),
    getDiagnosisRepo(),
    getBlueprintRepo(),
    getExamRepo(),
  );
}

/** Fetch active children for parent dashboard list. */
export function createGetActiveChildrenUseCase() {
  return new GetActiveChildrenUseCase(
    getParentLinkRepo(),
  );
}

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** Fetch notifications for current user. */
export function createGetNotificationsUseCase() {
  return new GetNotificationsUseCase(
    getNotificationRepo(),
  );
}

/** Mark one or all notifications as read. */
export function createMarkNotificationReadUseCase() {
  return new MarkNotificationReadUseCase(
    getNotificationRepo(),
  );
}

/** Submit user feedback on AI-generated content. */
export function createSubmitFeedbackUseCase() {
  return new SubmitFeedbackUseCase(
    getFeedbackRepo(),
  );
}

/** Update user profile fields (nickname, grade, schoolType, role). */
export function createUpdateUserProfileUseCase() {
  return new UpdateUserProfileUseCase(
    getUserRepo(),
  );
}

/** Fetch credit and subscription info for my page. */
export function createGetMyPageDataUseCase() {
  return new GetMyPageDataUseCase(
    getCreditRepo(),
    getSubscriptionRepo(),
  );
}

// =============================================================================
// Test Support: Reset all singletons (for unit/integration tests only)
// =============================================================================

/** @internal Reset all cached singleton instances. */
export function _resetContainer() {
  _userRepo = null;
  _examRepo = null;
  _questionRepo = null;
  _creditRepo = null;
  _blueprintRepo = null;
  _cacheRepo = null;
  _diagnosisRepo = null;
  _variantRepo = null;
  _miniTestRepo = null;
  _miniTestAnswerRepo = null;
  _notificationRepo = null;
  _subscriptionRepo = null;
  _followRepo = null;
  _sharedItemRepo = null;
  _parentLinkRepo = null;
  _feedbackRepo = null;
  _storageGateway = null;
}
