export type StudyStatus = 'draft' | 'active' | 'closed'
export type SurveyType = 'pre' | 'post'
export type QuestionType = 'multiple_choice' | 'checkbox' | 'likert' | 'short_text'

export interface Study {
  id: string
  title: string
  description: string
  consent_text: string
  status: StudyStatus
  target_per_condition: number
  has_background_check: boolean
  created_at: string
  updated_at: string
}

export interface BackgroundCheckQuestion {
  id: string
  study_id: string
  question_text: string
  question_type: QuestionType
  options_json: LikertOptions | ChoiceOptions | null
  correct_answer: string
  order_index: number
  created_at: string
}

export interface StudyResearcher {
  study_id: string
  researcher_id: string
  role: 'owner' | 'collaborator'
  created_at: string
}

export interface Condition {
  id: string
  study_id: string
  label: string
  course_url: string
  internal_notes: string
  display_order: number
  created_at: string
}

export interface SurveyQuestion {
  id: string
  condition_id: string
  survey_type: SurveyType
  question_text: string
  question_type: QuestionType
  options_json: LikertOptions | ChoiceOptions | null
  is_required: boolean
  order_index: number
}

export interface LikertOptions {
  scale: 5 | 7
  low_label: string
  high_label: string
}

export interface ChoiceOptions {
  choices: string[]
}

export interface Participant {
  id: string
  study_id: string
  condition_id: string
  student_id: string
  email: string
  consent_given_at: string | null
  completed_pre_survey: boolean
  completed_course: boolean
  completed_post_survey: boolean
  created_at: string
}

export interface DemographicResponse {
  id: string
  participant_id: string
  age_range: string
  gender: string
  education_level: string
  field_of_study: string
  prior_experience: number
}

export interface SurveyResponse {
  id: string
  participant_id: string
  question_id: string
  response_value: string
}

export interface Student {
  id: string
  email: string
  full_name: string | null
  created_at: string
}

export interface BackgroundCheckResponse {
  id: string
  participant_id: string
  question_id: string
  response_value: string
  created_at: string
}

// Enrollment session stored in sessionStorage
export interface EnrollmentSession {
  studyId: string
  participantId: string
  conditionId: string
  studentId: string
  step: number
}
