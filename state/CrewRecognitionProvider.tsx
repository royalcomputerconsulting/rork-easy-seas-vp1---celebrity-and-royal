import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import type { CrewMember, RecognitionEntryWithCrew, Sailing, SurveyListItem } from '@/types/crew-recognition';

interface CrewRecognitionFilters {
  search: string;
  shipName: string;
  month: string;
  year: number | null;
  department: string;
  roleTitle: string;
  startDate: string;
  endDate: string;
}

const DEFAULT_FILTERS: CrewRecognitionFilters = {
  search: '',
  shipName: '',
  month: '',
  year: null,
  department: '',
  roleTitle: '',
  startDate: '',
  endDate: '',
};

export const [CrewRecognitionProvider, useCrewRecognition] = createContextHook(() => {
  const [filters, setFilters] = useState<CrewRecognitionFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const statsQuery = trpc.crewRecognition.getStats.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const entriesQuery = trpc.crewRecognition.getRecognitionEntries.useQuery(
    {
      search: filters.search || undefined,
      shipName: filters.shipName || undefined,
      month: filters.month || undefined,
      year: filters.year || undefined,
      department: filters.department || undefined,
      roleTitle: filters.roleTitle || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      page,
      pageSize,
    },
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  const sailingsQuery = trpc.crewRecognition.getSailings.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const createCrewMemberMutation = trpc.crewRecognition.createCrewMember.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
    },
  });

  const updateCrewMemberMutation = trpc.crewRecognition.updateCrewMember.useMutation({
    onSuccess: () => {
      entriesQuery.refetch();
    },
  });

  const deleteCrewMemberMutation = trpc.crewRecognition.deleteCrewMember.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
    },
  });

  const createRecognitionEntryMutation = trpc.crewRecognition.createRecognitionEntry.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
    },
  });

  const updateRecognitionEntryMutation = trpc.crewRecognition.updateRecognitionEntry.useMutation({
    onSuccess: () => {
      entriesQuery.refetch();
    },
  });

  const deleteRecognitionEntryMutation = trpc.crewRecognition.deleteRecognitionEntry.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
    },
  });

  const createSailingMutation = trpc.crewRecognition.createSailing.useMutation({
    onSuccess: () => {
      sailingsQuery.refetch();
    },
  });

  const updateFilters = useCallback((newFilters: Partial<CrewRecognitionFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const nextPage = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const previousPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1));
  }, []);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  return {
    filters,
    updateFilters,
    resetFilters,
    page,
    pageSize,
    nextPage,
    previousPage,
    goToPage,
    stats: statsQuery.data || { crewMemberCount: 0, recognitionEntryCount: 0 },
    statsLoading: statsQuery.isLoading,
    entries: entriesQuery.data?.entries || [],
    entriesTotal: entriesQuery.data?.total || 0,
    entriesLoading: entriesQuery.isLoading,
    sailings: sailingsQuery.data || [],
    sailingsLoading: sailingsQuery.isLoading,
    createCrewMember: createCrewMemberMutation.mutateAsync,
    updateCrewMember: updateCrewMemberMutation.mutateAsync,
    deleteCrewMember: deleteCrewMemberMutation.mutateAsync,
    createRecognitionEntry: createRecognitionEntryMutation.mutateAsync,
    updateRecognitionEntry: updateRecognitionEntryMutation.mutateAsync,
    deleteRecognitionEntry: deleteRecognitionEntryMutation.mutateAsync,
    createSailing: createSailingMutation.mutateAsync,
    refetch: () => {
      statsQuery.refetch();
      entriesQuery.refetch();
      sailingsQuery.refetch();
    },
  };
});
