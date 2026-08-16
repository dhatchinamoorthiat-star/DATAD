function computeScores(collected) {
  const focus = _computeFocus(collected);
  const challenges = _computeChallenges(collected);
  const tone = _computeTone(collected, focus);
  const responseLength = _computeResponseLength(collected);
  const examples = _computeExamples(collected);
  const urgency = _computeUrgency(collected);
  const motivation = _computeMotivation(collected);
  const confidence = _computeConfidence(collected);
  const velocity = _computeLearningVelocity(collected);
  const readiness = _computeCareerReadiness(collected);
  const contextQuality = _computeContextQuality(collected);
  const intelligenceScore = _computeIntelligenceScore({
    motivation, confidence, velocity, readiness, contextQuality, urgency,
  });

  return {
    currentFocus: focus,
    currentChallenges: challenges,
    recommendedTone: tone,
    recommendedResponseLength: responseLength,
    recommendedExamples: examples,
    urgencyLevel: urgency,
    motivationLevel: motivation,
    confidence,
    learningVelocity: velocity,
    careerReadiness: readiness,
    contextQualityScore: contextQuality,
    intelligenceScore,
  };
}

function _computeFocus(collected) {
  if (collected.stress?.stressLevel > 60) return 'deadline-pressure';
  if (collected.tasks?.overdue > 2) return 'catch-up';
  if (collected.placement?.appliedCount > 0) return 'placement-prep';
  if (collected.identity?.daysToPlacement != null && collected.identity.daysToPlacement <= 60) return 'placement-prep';
  if (collected.career?.interviewCount > 0) return 'interview-prep';
  if (collected.tasks?.upcomingDeadlines?.length) return 'task-management';
  if (collected.learning?.streak > 5) return 'skill-building';
  if (collected.memory?.recentTopics?.length) return 'exploration';
  return 'general';
}

function _computeChallenges(collected) {
  const challenges = [];
  if (collected.stress?.stressLevel > 60) challenges.push('High stress');
  if (collected.stress?.overdueCount > 2) challenges.push('Overdue tasks');
  if (collected.stress?.rejectedCount > 1) challenges.push('Placement rejections');
  if (collected.learning?.weakTopics?.length) {
    challenges.push(`Weak in ${collected.learning.weakTopics.slice(0, 2).join(', ')}`);
  }
  if (collected.identity?.daysToPlacement != null && collected.identity.daysToPlacement < 30) {
    challenges.push('Imminent placement season');
  }
  if (collected.learning?.consistency != null && collected.learning.consistency < 30) {
    challenges.push('Inconsistent study habits');
  }
  if (collected.career?.hasResume === false) challenges.push('No resume uploaded');
  if (collected.learning?.streak === 0) challenges.push('No active learning streak');
  return challenges.slice(0, 4);
}

function _computeTone(collected, focus) {
  if (collected.stress?.stressLevel > 60) return 'supportive';
  if (collected.memory?.preferredExplanationStyle === 'concise') return 'direct';
  if (collected.memory?.preferredExplanationStyle === 'detailed') return 'detailed';
  if (collected.stress?.rejectedCount > 0) return 'encouraging';
  if (collected.learning?.motivationLevel != null && collected.learning.motivationLevel < 40) return 'encouraging';
  if (focus === 'deadline-pressure' || focus === 'catch-up') return 'direct';
  if (focus === 'placement-prep' || focus === 'interview-prep') return 'professional';
  if (focus === 'exploration') return 'curious';
  return 'neutral';
}

function _computeResponseLength(collected) {
  const style = collected.memory?.preferredExplanationStyle;
  if (style === 'concise') return 'short';
  if (style === 'detailed') return 'long';
  if (collected.stress?.stressLevel > 60) return 'short';
  if (collected.activity?.recentQueries?.length) {
    const avgLength = collected.activity.recentQueries.reduce(
      (sum, q) => sum + (q.text?.length || 0), 0
    ) / Math.max(1, collected.activity.recentQueries.length);
    if (avgLength < 50) return 'short';
    if (avgLength > 200) return 'long';
  }
  return 'moderate';
}

function _computeExamples(collected) {
  const examples = [];
  if (collected.career?.skills?.length) {
    examples.push(...collected.career.skills.slice(0, 2));
  }
  if (collected.identity?.preferredIndustries?.length) {
    examples.push(collected.identity.preferredIndustries[0]);
  }
  if (collected.memory?.recentTopics?.length) {
    examples.push(collected.memory.recentTopics[0]);
  }
  if (collected.learning?.strongTopics?.length) {
    examples.push(collected.learning.strongTopics[0]);
  }
  return [...new Set(examples)].slice(0, 3);
}

function _computeUrgency(collected) {
  let urgency = 0;
  if (collected.tasks?.overdue > 0) urgency += Math.min(collected.tasks.overdue * 15, 40);
  if (collected.stress?.nearDeadlineCount > 0) urgency += Math.min(collected.stress.nearDeadlineCount * 10, 30);
  if (collected.identity?.daysToPlacement != null && collected.identity.daysToPlacement <= 30) urgency += 30;
  if (collected.identity?.daysToPlacement != null && collected.identity.daysToPlacement <= 7) urgency += 20;
  return Math.min(100, urgency);
}

function _computeMotivation(collected) {
  let score = 50;

  if (collected.learning?.streak > 10) score += 15;
  else if (collected.learning?.streak > 5) score += 10;
  else if (collected.learning?.streak > 0) score += 5;

  if (collected.learning?.consistency > 70) score += 10;
  else if (collected.learning?.consistency > 40) score += 5;

  if (collected.career?.offerCount > 0) score += 15;
  if (collected.career?.interviewCount > 0) score += 10;

  if (collected.stress?.stressLevel > 60) score -= 15;
  if (collected.stress?.rejectedCount > 1) score -= 10;
  if (collected.stress?.overdueCount > 3) score -= 10;

  if (collected.identity?.daysToPlacement != null && collected.identity.daysToPlacement < 30) {
    score += 10;
  }

  if (collected.activity?.aiCallsToday > 5) score += 5;
  if (collected.activity?.chatMessagesToday > 3) score += 5;

  return Math.max(0, Math.min(100, score));
}

function _computeConfidence(collected) {
  let score = 50;

  if (collected.career?.skills?.length > 10) score += 10;
  if (collected.career?.skills?.length > 5) score += 5;
  if (collected.career?.experienceCount > 1) score += 10;
  if (collected.career?.educationCount > 0) score += 5;

  if (collected.memory?.readinessScore != null) {
    score += (collected.memory.readinessScore - 50) * 0.3;
  }

  if (collected.learning?.streak > 5) score += 5;
  if (collected.learning?.strongTopics?.length > 3) score += 5;

  if (collected.stress?.rejectedCount > 0) score -= collected.stress.rejectedCount * 5;

  if (collected.identity?.daysToPlacement != null && collected.identity.daysToPlacement > 90) score += 5;

  if (collected.career?.starStoriesCount > 3) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function _computeLearningVelocity(collected) {
  let velocity = 50;

  if (collected.learning?.consistency > 70) velocity += 15;
  else if (collected.learning?.consistency > 40) velocity += 8;

  if (collected.learning?.streak > 10) velocity += 10;
  else if (collected.learning?.streak > 5) velocity += 5;

  if (collected.learning?.todayStudyMinutes > 30) velocity += 5;

  if (collected.tasks?.completed > 10) velocity += 5;

  if (collected.learning?.tasksCompleted7d > 3) velocity += 5;

  if (collected.notes?.total > 10) velocity += 5;

  if (collected.learning?.weakTopics?.length > 3) velocity -= 5;

  return Math.max(0, Math.min(100, velocity));
}

function _computeCareerReadiness(collected) {
  let readiness = 0;

  if (collected.career?.hasResume) readiness += 20;
  if (collected.career?.summary) readiness += 10;
  if (collected.career?.skillCount > 10) readiness += 10;
  if (collected.career?.skillCount > 5) readiness += 5;

  if (collected.career?.experienceCount > 0) readiness += 10;
  if (collected.career?.educationCount > 0) readiness += 5;

  if (collected.career?.companiesResearched > 10) readiness += 10;
  else if (collected.career?.companiesResearched > 5) readiness += 5;

  if (collected.career?.starStoriesCount > 3) readiness += 10;
  else if (collected.career?.starStoriesCount > 0) readiness += 5;

  if (collected.career?.applications > 0) readiness += 5;

  if (collected.memory?.readinessScore != null) {
    readiness = readiness * 0.5 + collected.memory.readinessScore * 0.5;
  }

  if (collected.identity?.daysToPlacement != null) {
    if (collected.identity.daysToPlacement <= 30) readiness += 10;
    else if (collected.identity.daysToPlacement <= 60) readiness += 5;
  }

  if (collected.learning?.weakTopics?.length > 3) readiness -= 5;

  return Math.max(0, Math.min(100, Math.round(readiness)));
}

function _computeContextQuality(collected) {
  let fields = 0;
  if (collected.identity) fields++;
  if (collected.memory) fields++;
  if (collected.tasks) fields++;
  if (collected.notes) fields++;
  if (collected.career) fields++;
  if (collected.learning) fields++;
  if (collected.activity) fields++;
  if (collected.planner) fields++;
  if (collected.stress) fields++;
  if (collected.study) fields++;

  const maxFields = 10;
  return Math.round((fields / maxFields) * 100);
}

function _computeIntelligenceScore({ motivation, confidence, velocity, readiness, contextQuality, urgency }) {
  return Math.round(
    motivation * 0.15 +
    confidence * 0.15 +
    velocity * 0.15 +
    readiness * 0.20 +
    contextQuality * 0.15 +
    (100 - urgency) * 0.20
  );
}

module.exports = { computeScores };
