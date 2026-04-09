import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import useAuthStore from '@/presentation/stores/useAuthStore';
import { createUpdateUserProfileUseCase } from '@/di/container';
import { COLORS } from '@/presentation/theme';

interface GradeOption {
  label: string;
  grade: string;
  schoolType: 'middle' | 'high';
}

const MIDDLE_GRADES: GradeOption[] = [
  { label: '중1', grade: 'mid1', schoolType: 'middle' },
  { label: '중2', grade: 'mid2', schoolType: 'middle' },
  { label: '중3', grade: 'mid3', schoolType: 'middle' },
];

const HIGH_GRADES: GradeOption[] = [
  { label: '고1', grade: 'high1', schoolType: 'high' },
  { label: '고2', grade: 'high2', schoolType: 'high' },
  { label: '고3', grade: 'high3', schoolType: 'high' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [nickname, setNickname] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<GradeOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isParent = user?.role === 'parent';
  const isValidNickname = nickname.trim().length >= 2 && nickname.trim().length <= 12;
  const canSubmit = isValidNickname && !isSubmitting;

  const handleSubmit = async () => {
    setError(null);

    if (!isValidNickname) {
      setError('닉네임은 2~12자로 입력해주세요.');
      return;
    }

    if (!user) {
      setError('로그인 정보를 찾을 수 없습니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      // UpdateUserProfileUseCase를 통해 프로필을 저장한다.
      // userId는 Supabase Auth UUID(user.id)이며, use case 내부에서 auth_id 기반 조회 후 update한다.
      const useCase = createUpdateUserProfileUseCase();
      const updateData: Parameters<typeof useCase.execute>[0]['data'] = {
        nickname: nickname.trim(),
      };

      if (!isParent && selectedGrade) {
        updateData.grade = selectedGrade.grade;
        updateData.schoolType = selectedGrade.schoolType;
      }

      await useCase.execute({ userId: user.id, data: updateData });

      // Zustand 스토어의 user 정보 업데이트
      useAuthStore.setState({
        user: {
          ...user,
          nickname: nickname.trim(),
          grade: selectedGrade?.grade ?? user.grade ?? null,
          schoolType: selectedGrade?.schoolType ?? user.schoolType ?? null,
        },
      });

      router.replace('/(tabs)');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '프로필 저장에 실패했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderGradeButton = (option: GradeOption) => {
    const isSelected = selectedGrade?.grade === option.grade;
    return (
      <TouchableOpacity
        key={option.grade}
        style={[styles.gradeButton, isSelected && styles.gradeButtonActive]}
        onPress={() => setSelectedGrade(option)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.gradeButtonText,
            isSelected && styles.gradeButtonTextActive,
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <Text style={styles.title}>프로필 설정</Text>
          <Text style={styles.subtitle}>
            시험의 신에 오신 것을 환영합니다!
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="2~12자 닉네임"
              placeholderTextColor="#9CA3AF"
              maxLength={12}
              autoCapitalize="none"
            />
          </View>

          {!isParent && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>학년</Text>

              <Text style={styles.sectionLabel}>중학교</Text>
              <View style={styles.gradeRow}>
                {MIDDLE_GRADES.map(renderGradeButton)}
              </View>

              <Text style={styles.sectionLabel}>고등학교</Text>
              <View style={styles.gradeRow}>
                {HIGH_GRADES.map(renderGradeButton)}
              </View>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>시작하기</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 8,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gradeButton: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  gradeButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  gradeButtonTextActive: {
    color: '#FFFFFF',
  },
  error: {
    fontSize: 14,
    color: COLORS.alert,
    marginBottom: 16,
  },
  button: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
