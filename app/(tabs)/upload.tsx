import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';
import useExamStore from '@/presentation/stores/useExamStore';
import type { SubjectOrOther } from '@/domain/value-objects/Subject';
import { ALL_SUBJECTS, getSubjectLabel } from '@/domain/rules/subjectRules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelectedImage {
  uri: string;
  fileName: string;
  mimeType: string;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UploadScreen() {
  const { uploadExam } = useExamStore();

  const [subject, setSubject] = useState<SubjectOrOther | null>(null);
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = subject !== null && image !== null && status !== 'uploading';

  // ---- Permission helper ----
  const requestPermission = useCallback(async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('권한 필요', '카메라 접근 권한을 허용해 주세요.');
        return false;
      }
    } else {
      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('권한 필요', '갤러리 접근 권한을 허용해 주세요.');
        return false;
      }
    }
    return true;
  }, []);

  // ---- Pick image ----
  const pickImage = useCallback(
    async (source: 'camera' | 'library') => {
      const ok = await requestPermission(source);
      if (!ok) return;

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || result.assets.length === 0) return;

      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        fileName: asset.fileName ?? `exam_${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      setErrorMsg(null);
    },
    [requestPermission],
  );

  // ---- Upload & create exam (UseCase 경유 + OCR 트리거) ----
  const handleUpload = useCallback(async () => {
    if (!canSubmit || !image || !subject) return;

    setStatus('uploading');
    setErrorMsg(null);

    try {
      // UseCase를 통한 업로드 (크레딧 차감, 파일 검증, Storage 업로드, exam 생성)
      const examId = await uploadExam(image.uri, subject);

      setStatus('success');

      // 시험 상세 화면으로 이동 (OCR은 스토어에서 트리거됨)
      router.push(`/exam/${examId}`);

      // 폼 초기화
      setTimeout(() => {
        setSubject(null);
        setImage(null);
        setStatus('idle');
      }, 500);
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : '업로드에 실패했습니다.';
      setErrorMsg(message);
    }
  }, [canSubmit, image, subject, uploadExam]);

  // ---- Render ----
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>시험지 업로드</Text>

        {/* Error banner */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Subject selection */}
        <Text style={styles.sectionLabel}>과목 선택</Text>
        <View style={styles.subjectRow}>
          {ALL_SUBJECTS.map((s) => {
            const isSelected = subject === s;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.subjectButton,
                  isSelected && styles.subjectButtonActive,
                ]}
                onPress={() => setSubject(s)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.subjectButtonText,
                    isSelected && styles.subjectButtonTextActive,
                  ]}
                >
                  {getSubjectLabel(s)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Image picker area */}
        <Text style={styles.sectionLabel}>시험지 이미지</Text>

        {image ? (
          // Image preview
          <View style={styles.previewContainer}>
            <Image source={{ uri: image.uri }} style={styles.previewImage} resizeMode="contain" />
            <TouchableOpacity onPress={() => setImage(null)} activeOpacity={0.7}>
              <Text style={styles.retakeLink}>다시 선택</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Empty placeholder + buttons
          <View style={styles.placeholderBox}>
            <Text style={styles.placeholderIcon}>📄</Text>
            <Text style={styles.placeholderText}>
              시험지 사진을 촬영하거나{'\n'}갤러리에서 선택하세요
            </Text>
          </View>
        )}

        <View style={styles.pickerButtonRow}>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => pickImage('camera')}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerButtonIcon}>📷</Text>
            <Text style={styles.pickerButtonText}>카메라로 촬영</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => pickImage('library')}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerButtonIcon}>🖼</Text>
            <Text style={styles.pickerButtonText}>갤러리에서 선택</Text>
          </TouchableOpacity>
        </View>

        {/* Upload button */}
        <View style={styles.bottomArea}>
          <TouchableOpacity
            style={[styles.uploadButton, !canSubmit && styles.uploadButtonDisabled]}
            onPress={handleUpload}
            disabled={!canSubmit}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.uploadButtonText,
                !canSubmit && styles.uploadButtonTextDisabled,
              ]}
            >
              {status === 'uploading' ? '업로드 중...' : '분석 시작'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading overlay */}
        {status === 'uploading' && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
              <Text style={styles.loadingText}>업로드 중...</Text>
              <Text style={styles.loadingSubtext}>잠시만 기다려 주세요</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },

  // Error banner
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: COLORS.alert,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.alert,
  },

  // Section label
  sectionLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },

  // Subject buttons
  subjectRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  subjectButton: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
  },
  subjectButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF2FF',
  },
  subjectButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  subjectButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Image placeholder
  placeholderBox: {
    height: 200,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  placeholderText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Image preview
  previewContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  retakeLink: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Picker buttons
  pickerButtonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
  },
  pickerButtonIcon: {
    fontSize: 18,
  },
  pickerButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Upload button
  bottomArea: {
    marginTop: 'auto',
    paddingBottom: SPACING.lg,
  },
  uploadButton: {
    minHeight: MIN_TOUCH_TARGET + 8,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  uploadButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  uploadButtonTextDisabled: {
    color: COLORS.textTertiary,
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingBox: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  loadingSubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
});
