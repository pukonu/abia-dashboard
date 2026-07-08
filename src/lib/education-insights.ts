import type { DashboardData } from "./types";

export interface EducationStat {
  label: string;
  value: string;
  caption: string;
}

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export interface PeerEducationState {
  state: string;
  primaryEnrollment: number;
  secondaryEnrollment: number;
  completionRate: number;
}

export interface SmartSchoolMetric {
  label: string;
  value: string;
  progress: number;
  caption: string;
}

export interface UrgentSchoolMatter {
  school: string;
  lga: string;
  issue: string;
  severity: "High" | "Critical";
  estimatedCost: string;
}

function fmt(value: number): string {
  return value.toLocaleString("en-NG");
}

function countEntities(data: DashboardData, type: string): number {
  return data.entities.filter((entity) => entity.entity_type === type).length;
}

export function educationLandingInsights(data: DashboardData) {
  const primarySchools = countEntities(data, "Primary School");
  const secondarySchools = countEntities(data, "Secondary School");
  const primaryEnrollment = 184_500;
  const secondaryEnrollment = 96_200;

  return {
    stats: [
      {
        label: "Primary schools tracked",
        value: fmt(primarySchools),
        caption: "Public basic education access points in the dashboard sample.",
      },
      {
        label: "Secondary schools tracked",
        value: fmt(secondarySchools),
        caption: "Post-primary institutions currently measured.",
      },
      {
        label: "Primary enrolment",
        value: fmt(primaryEnrollment),
        caption: "Pupils enrolled across public primary schools.",
      },
      {
        label: "Secondary enrolment",
        value: fmt(secondaryEnrollment),
        caption: "Students enrolled across public secondary schools.",
      },
    ] satisfies EducationStat[],
    gender: {
      primary: [
        { label: "Girls", value: 49, color: "#e11d48" },
        { label: "Boys", value: 51, color: "#2563eb" },
      ] satisfies PieSlice[],
      secondary: [
        { label: "Girls", value: 47, color: "#e11d48" },
        { label: "Boys", value: 53, color: "#2563eb" },
      ] satisfies PieSlice[],
    },
    peerStates: [
      { state: "Abia", primaryEnrollment, secondaryEnrollment, completionRate: 82 },
      { state: "Imo", primaryEnrollment: 211_300, secondaryEnrollment: 105_600, completionRate: 79 },
      { state: "Enugu", primaryEnrollment: 198_700, secondaryEnrollment: 112_400, completionRate: 84 },
      { state: "Akwa Ibom", primaryEnrollment: 226_100, secondaryEnrollment: 118_900, completionRate: 81 },
      { state: "Ebonyi", primaryEnrollment: 163_800, secondaryEnrollment: 74_500, completionRate: 76 },
    ] satisfies PeerEducationState[],
    smartSchools: [
      {
        label: "Smart schools live",
        value: "12",
        progress: 40,
        caption: "Schools with digital classrooms, connectivity and trained operators.",
      },
      {
        label: "Smart schools in rollout",
        value: "18",
        progress: 60,
        caption: "Sites with procurement, installation or teacher onboarding in progress.",
      },
      {
        label: "Teachers trained",
        value: "420",
        progress: 56,
        caption: "Teachers trained on smart boards, tablets and digital lesson delivery.",
      },
      {
        label: "Learners reached",
        value: "18,600",
        progress: 48,
        caption: "Estimated students currently benefiting from smart-school interventions.",
      },
    ] satisfies SmartSchoolMetric[],
    urgentMatters: [
      {
        school: "Osisioma Model Basic School",
        lga: "Osisioma Ngwa",
        issue: "Classroom roof failure and unsafe ceiling sections",
        severity: "Critical",
        estimatedCost: "NGN 42m",
      },
      {
        school: "Bende Community Secondary School",
        lga: "Bende",
        issue: "Dilapidated science block and broken laboratory fittings",
        severity: "High",
        estimatedCost: "NGN 31m",
      },
      {
        school: "Girls' Secondary School Aba",
        lga: "Aba North",
        issue: "Toilet rehabilitation and perimeter security repairs",
        severity: "High",
        estimatedCost: "NGN 24m",
      },
    ] satisfies UrgentSchoolMatter[],
  };
}
