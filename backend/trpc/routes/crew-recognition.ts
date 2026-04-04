import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { getDb } from "../../db";

const departmentEnum = z.enum([
  'Casino',
  'Dining',
  'Housekeeping',
  'Guest Relations',
  'Activities',
  'Spa',
  'Retail',
  'Beverage',
  'Loyalty',
  'Public Areas',
  'Other',
]);

function normalizeString(str: string): string {
  return str.trim().toLowerCase();
}

function generateSailingMonth(date: string): string {
  return date.substring(0, 7);
}

function generateSailingYear(date: string): number {
  return parseInt(date.substring(0, 4), 10);
}

export const crewRecognitionRouter = createTRPCRouter({
  getCSVContent: publicProcedure.query(async () => {
    try {
      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || 'g131hcw7cxhvg2godfob0';
      const csvUrl = `https://rork.app/pa/${projectId}/Crew_Recognition.csv`;
      console.log('[CrewRecognition Backend] Fetching CSV from:', csvUrl);
      
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const csvContent = await response.text();
      
      if (!csvContent || csvContent.trim().length === 0) {
        throw new Error('CSV content is empty');
      }
      
      console.log('[CrewRecognition Backend] CSV fetched, length:', csvContent.length);
      return { content: csvContent };
    } catch (error) {
      console.error('[CrewRecognition Backend] Failed to fetch CSV:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to read CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }),

  syncFromCSV: publicProcedure
    .input(
      z.object({
        csvText: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      const lines = input.csvText.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'CSV file is empty or invalid',
        });
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^[\uFEFF"']/g, '').replace(/["']$/g, ''));
      const data = lines.slice(1);
      
      let importedCount = 0;
      const now = new Date().toISOString();
      
      for (const line of data) {
        const values = line.split(',').map(v => v.trim().replace(/^["']/g, '').replace(/["']$/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        const crewName = row['Crew_Name'] || row['crew_name'] || row['Crew Name'];
        const department = row['Department'] || row['department'];
        const roleTitle = row['Role'] || row['role'] || row['Role_Title'] || row['roleTitle'];
        const notes = row['Notes'] || row['notes'];
        const shipName = row['Ship'] || row['ship'] || row['Ship_Name'] || row['shipName'];
        const startDate = row['Start_Date'] || row['start_date'] || row['Start Date'];
        const endDate = row['End_Date'] || row['end_date'] || row['End Date'];
        
        if (!crewName || !department) {
          continue;
        }
        
        const normalizedName = normalizeString(crewName);
        const existingResult = await db.query(
          `SELECT * FROM crew_members WHERE string::lowercase(fullName) = "${normalizedName}" AND userId = "${input.userId}" AND isDeleted != true LIMIT 1`
        );
        
        let crewMember = (existingResult[0] as any[])?.[0];
        
        if (!crewMember) {
          const crewData = {
            fullName: crewName.trim(),
            department: department.trim(),
            roleTitle: roleTitle?.trim() || undefined,
            notes: notes?.trim() || undefined,
            userId: input.userId,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
          };
          
          const createResult = await db.create('crew_members', crewData);
          crewMember = Array.isArray(createResult) ? createResult[0] : createResult;
          importedCount++;
        }
        
        if (crewMember?.id && shipName && startDate) {
          const sailingResult = await db.query(
            `SELECT * FROM sailings WHERE shipName = "${shipName.trim()}" AND sailStartDate = "${startDate.trim()}" AND userId = "${input.userId}" LIMIT 1`
          );
          
          let sailing = (sailingResult[0] as any[])?.[0];
          
          if (!sailing) {
            const sailingData = {
              shipName: shipName.trim(),
              sailStartDate: startDate.trim(),
              sailEndDate: endDate?.trim() || startDate.trim(),
              userId: input.userId,
              createdAt: now,
              updatedAt: now,
            };
            
            const createSailingResult = await db.create('sailings', sailingData);
            sailing = Array.isArray(createSailingResult) ? createSailingResult[0] : createSailingResult;
          }
          
          if (sailing?.id) {
            const existingEntryResult = await db.query(
              `SELECT * FROM recognition_entries WHERE crewMemberId = "${crewMember.id}" AND sailingId = "${sailing.id}" LIMIT 1`
            );
            
            if ((existingEntryResult[0] as any[])?.length === 0) {
              const entryData = {
                crewMemberId: crewMember.id,
                sailingId: sailing.id,
                shipName: sailing.shipName,
                sailStartDate: sailing.sailStartDate,
                sailEndDate: sailing.sailEndDate,
                sailingMonth: generateSailingMonth(sailing.sailStartDate),
                sailingYear: generateSailingYear(sailing.sailStartDate),
                department: department.trim(),
                roleTitle: roleTitle?.trim() || undefined,
                sourceText: `Imported from CSV`,
                userId: input.userId,
                createdAt: now,
                updatedAt: now,
              };
              
              await db.create('recognition_entries', entryData);
            }
          }
        }
      }
      
      return { success: true, importedCount };
    }),

  getCrewMembers: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        department: z.string().optional(),
        userId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      
      let query = `SELECT * FROM crew_members WHERE userId = "${input.userId}" AND isDeleted != true`;
      const conditions: string[] = [];
      
      if (input.search) {
        conditions.push(`string::lowercase(fullName) CONTAINS "${normalizeString(input.search)}"`);
      }
      
      if (input.department) {
        conditions.push(`department = "${input.department}"`);
      }
      
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY fullName ASC';
      
      const result = await db.query(query);
      return (result[0] || []) as any[];
    }),

  createCrewMember: publicProcedure
    .input(
      z.object({
        fullName: z.string().min(1),
        department: departmentEnum,
        roleTitle: z.string().optional(),
        notes: z.string().optional(),
        sailingId: z.string().optional(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      const normalizedName = normalizeString(input.fullName);
      const existingResult = await db.query(
        `SELECT * FROM crew_members WHERE string::lowercase(fullName) = "${normalizedName}" AND userId = "${input.userId}" AND isDeleted != true LIMIT 1`
      );
      
      const existing = (existingResult[0] as any[])?.[0];
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A crew member with this name already exists',
        });
      }
      
      const now = new Date().toISOString();
      const crewMemberData = {
        fullName: input.fullName.trim(),
        department: input.department,
        roleTitle: input.roleTitle?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        userId: input.userId,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      
      const createResult = await db.create('crew_members', crewMemberData);
      const crewMember = Array.isArray(createResult) ? createResult[0] : createResult;
      
      if (input.sailingId && crewMember?.id) {
        const sailingResult = await db.query(`SELECT * FROM sailings WHERE id = "${input.sailingId}" LIMIT 1`);
        const sailing = (sailingResult[0] as any[])?.[0];
        
        if (sailing) {
          const entryData = {
            crewMemberId: crewMember.id,
            sailingId: input.sailingId,
            shipName: sailing.shipName,
            sailStartDate: sailing.sailStartDate,
            sailEndDate: sailing.sailEndDate,
            sailingMonth: generateSailingMonth(sailing.sailStartDate),
            sailingYear: generateSailingYear(sailing.sailStartDate),
            department: input.department,
            roleTitle: input.roleTitle?.trim() || undefined,
            sourceText: undefined,
            userId: input.userId,
            createdAt: now,
            updatedAt: now,
          };
          
          await db.create('recognition_entries', entryData);
        }
      }
      
      return crewMember;
    }),

  updateCrewMember: publicProcedure
    .input(
      z.object({
        id: z.string(),
        fullName: z.string().min(1),
        department: departmentEnum,
        roleTitle: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      const now = new Date().toISOString();
      const updateData = {
        fullName: input.fullName.trim(),
        department: input.department,
        roleTitle: input.roleTitle?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        updatedAt: now,
      };
      
      const result = await db.merge(input.id, updateData);
      return result;
    }),

  deleteCrewMember: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      const entriesResult = await db.query(
        `SELECT * FROM recognition_entries WHERE crewMemberId = "${input.id}" LIMIT 1`
      );
      
      const hasEntries = (entriesResult[0] as any[])?.length > 0;
      if (hasEntries) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot delete crew member with existing recognition entries',
        });
      }
      
      await db.merge(input.id, { isDeleted: true, updatedAt: new Date().toISOString() });
      return { success: true };
    }),

  getRecognitionEntries: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        shipNames: z.array(z.string()).optional(),
        month: z.string().optional(),
        year: z.number().optional(),
        departments: z.array(z.string()).optional(),
        roleTitle: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(50),
        userId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      
      const conditions: string[] = [`userId = "${input.userId}"`];
      
      if (input.search) {
        const crewResult = await db.query(
          `SELECT id FROM crew_members WHERE userId = "${input.userId}" AND string::lowercase(fullName) CONTAINS "${normalizeString(input.search)}"`
        );
        const crewIds = ((crewResult[0] as any[]) || []).map((c: any) => c.id);
        
        if (crewIds.length > 0) {
          conditions.push(`crewMemberId IN [${crewIds.map(id => `"${id}"`).join(',')}]`);
        } else {
          return { entries: [], total: 0 };
        }
      }
      
      if (input.shipNames && input.shipNames.length > 0) {
        conditions.push(`shipName IN [${input.shipNames.map(s => `"${s}"`).join(',')}]`);
      }
      
      if (input.month) {
        conditions.push(`sailingMonth = "${input.month}"`);
      }
      
      if (input.year) {
        conditions.push(`sailingYear = ${input.year}`);
      }
      
      if (input.departments && input.departments.length > 0) {
        conditions.push(`department IN [${input.departments.map(d => `"${d}"`).join(',')}]`);
      }
      
      if (input.roleTitle) {
        conditions.push(`string::lowercase(roleTitle) CONTAINS "${normalizeString(input.roleTitle)}"`);
      }
      
      if (input.startDate) {
        conditions.push(`sailStartDate >= "${input.startDate}"`);
      }
      
      if (input.endDate) {
        conditions.push(`sailEndDate <= "${input.endDate}"`);
      }
      
      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
      
      const countQuery = `SELECT count() FROM recognition_entries ${whereClause} GROUP ALL`;
      const countResult = await db.query(countQuery);
      const total = (countResult[0] as any[])?.[0]?.count || 0;
      
      const offset = (input.page - 1) * input.pageSize;
      const query = `SELECT * FROM recognition_entries ${whereClause} ORDER BY sailStartDate DESC LIMIT ${input.pageSize} START ${offset}`;
      
      const entriesResult = await db.query(query);
      const entries = (entriesResult[0] || []) as any[];
      
      const entriesWithCrew = await Promise.all(
        entries.map(async (entry: any) => {
          const crewResult = await db.query(`SELECT * FROM crew_members WHERE id = "${entry.crewMemberId}" LIMIT 1`);
          const crew = (crewResult[0] as any[])?.[0];
          
          return {
            ...entry,
            fullName: crew?.fullName || 'Unknown',
            crewNotes: crew?.notes,
          };
        })
      );
      
      return { entries: entriesWithCrew, total };
    }),

  createRecognitionEntry: publicProcedure
    .input(
      z.object({
        crewMemberId: z.string(),
        sailingId: z.string(),
        department: departmentEnum,
        roleTitle: z.string().optional(),
        sourceText: z.string().optional(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      const sailingResult = await db.query(`SELECT * FROM sailings WHERE id = "${input.sailingId}" LIMIT 1`);
      const sailing = (sailingResult[0] as any[])?.[0];
      
      if (!sailing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sailing not found',
        });
      }
      
      const now = new Date().toISOString();
      const entryData = {
        crewMemberId: input.crewMemberId,
        sailingId: input.sailingId,
        shipName: sailing.shipName,
        sailStartDate: sailing.sailStartDate,
        sailEndDate: sailing.sailEndDate,
        sailingMonth: generateSailingMonth(sailing.sailStartDate),
        sailingYear: generateSailingYear(sailing.sailStartDate),
        department: input.department,
        roleTitle: input.roleTitle?.trim() || undefined,
        sourceText: input.sourceText?.trim() || undefined,
        userId: input.userId,
        createdAt: now,
        updatedAt: now,
      };
      
      const result = await db.create('recognition_entries', entryData);
      return result;
    }),

  updateRecognitionEntry: publicProcedure
    .input(
      z.object({
        id: z.string(),
        sailingId: z.string().optional(),
        department: departmentEnum.optional(),
        roleTitle: z.string().optional(),
        sourceText: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };
      
      if (input.sailingId) {
        const sailingResult = await db.query(`SELECT * FROM sailings WHERE id = "${input.sailingId}" LIMIT 1`);
        const sailing = (sailingResult[0] as any[])?.[0];
        
        if (sailing) {
          updateData.sailingId = input.sailingId;
          updateData.shipName = sailing.shipName;
          updateData.sailStartDate = sailing.sailStartDate;
          updateData.sailEndDate = sailing.sailEndDate;
          updateData.sailingMonth = generateSailingMonth(sailing.sailStartDate);
          updateData.sailingYear = generateSailingYear(sailing.sailStartDate);
        }
      }
      
      if (input.department) {
        updateData.department = input.department;
      }
      
      if (input.roleTitle !== undefined) {
        updateData.roleTitle = input.roleTitle.trim() || undefined;
      }
      
      if (input.sourceText !== undefined) {
        updateData.sourceText = input.sourceText.trim() || undefined;
      }
      
      const result = await db.merge(input.id, updateData);
      return result;
    }),

  deleteRecognitionEntry: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(input.id);
      return { success: true };
    }),

  syncBatch: publicProcedure
    .input(
      z.object({
        rows: z.array(z.object({
          crewName: z.string(),
          department: z.string(),
          roleTitle: z.string(),
          notes: z.string(),
          shipName: z.string(),
          startDate: z.string(),
          endDate: z.string(),
        })),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const now = new Date().toISOString();
      let importedCount = 0;

      for (const row of input.rows) {
        if (!row.crewName || !row.department) continue;

        const normalizedName = normalizeString(row.crewName);
        const existingResult = await db.query(
          `SELECT * FROM crew_members WHERE string::lowercase(fullName) = "${normalizedName}" AND userId = "${input.userId}" AND isDeleted != true LIMIT 1`
        );

        let crewMember = (existingResult[0] as any[])?.[0];

        if (!crewMember) {
          const crewData = {
            fullName: row.crewName.trim(),
            department: row.department.trim(),
            roleTitle: row.roleTitle?.trim() || undefined,
            notes: row.notes?.trim() || undefined,
            userId: input.userId,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
          };

          const createResult = await db.create('crew_members', crewData);
          crewMember = Array.isArray(createResult) ? createResult[0] : createResult;
          importedCount++;
        }

        if (crewMember?.id && row.shipName && row.startDate) {
          const sailingResult = await db.query(
            `SELECT * FROM sailings WHERE shipName = "${row.shipName.trim()}" AND sailStartDate = "${row.startDate.trim()}" AND userId = "${input.userId}" LIMIT 1`
          );

          let sailing = (sailingResult[0] as any[])?.[0];

          if (!sailing) {
            const sailingData = {
              shipName: row.shipName.trim(),
              sailStartDate: row.startDate.trim(),
              sailEndDate: row.endDate?.trim() || row.startDate.trim(),
              userId: input.userId,
              createdAt: now,
              updatedAt: now,
            };

            const createSailingResult = await db.create('sailings', sailingData);
            sailing = Array.isArray(createSailingResult) ? createSailingResult[0] : createSailingResult;
          }

          if (sailing?.id) {
            const existingEntryResult = await db.query(
              `SELECT * FROM recognition_entries WHERE crewMemberId = "${crewMember.id}" AND sailingId = "${sailing.id}" LIMIT 1`
            );

            if ((existingEntryResult[0] as any[])?.length === 0) {
              const entryData = {
                crewMemberId: crewMember.id,
                sailingId: sailing.id,
                shipName: sailing.shipName,
                sailStartDate: sailing.sailStartDate,
                sailEndDate: sailing.sailEndDate,
                sailingMonth: generateSailingMonth(sailing.sailStartDate),
                sailingYear: generateSailingYear(sailing.sailStartDate),
                department: row.department.trim(),
                roleTitle: row.roleTitle?.trim() || undefined,
                sourceText: 'Imported from CSV',
                userId: input.userId,
                createdAt: now,
                updatedAt: now,
              };

              await db.create('recognition_entries', entryData);
            }
          }
        }
      }

      return { success: true, importedCount };
    }),

  getSailings: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const result = await db.query(`SELECT * FROM sailings WHERE userId = "${input.userId}" ORDER BY sailStartDate DESC`);
      return (result[0] || []) as any[];
    }),

  createSailing: publicProcedure
    .input(
      z.object({
        shipName: z.string().min(1),
        sailStartDate: z.string(),
        sailEndDate: z.string(),
        nights: z.number().optional(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      
      const now = new Date().toISOString();
      const sailingData = {
        shipName: input.shipName.trim(),
        sailStartDate: input.sailStartDate,
        sailEndDate: input.sailEndDate,
        nights: input.nights,
        userId: input.userId,
        createdAt: now,
        updatedAt: now,
      };
      
      const result = await db.create('sailings', sailingData);
      return result;
    }),

  getSurveyList: publicProcedure
    .input(z.object({ sailingId: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      
      const query = `
        SELECT 
          crewMemberId,
          count() as mentionCount
        FROM recognition_entries 
        WHERE sailingId = "${input.sailingId}"
        GROUP BY crewMemberId
      `;
      
      const result = await db.query(query);
      const grouped = (result[0] || []) as any[];
      
      const surveyList = await Promise.all(
        grouped.map(async (item: any) => {
          const crewResult = await db.query(`SELECT * FROM crew_members WHERE id = "${item.crewMemberId}" LIMIT 1`);
          const crew = (crewResult[0] as any[])?.[0];
          
          const entryResult = await db.query(
            `SELECT * FROM recognition_entries WHERE crewMemberId = "${item.crewMemberId}" AND sailingId = "${input.sailingId}" LIMIT 1`
          );
          const entry = (entryResult[0] as any[])?.[0];
          
          return {
            fullName: crew?.fullName || 'Unknown',
            department: entry?.department || crew?.department || 'Unknown',
            roleTitle: entry?.roleTitle || crew?.roleTitle,
            mentionCount: item.mentionCount || 1,
          };
        })
      );
      
      return surveyList.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }),

  getStats: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      
      const crewCountQuery = `SELECT count() FROM crew_members WHERE userId = "${input.userId}" AND isDeleted != true GROUP ALL`;
      const crewCountResult = await db.query(crewCountQuery);
      const crewCount = (crewCountResult[0] as any[])?.[0]?.count || 0;
      
      const entriesCountQuery = `SELECT count() FROM recognition_entries WHERE userId = "${input.userId}" GROUP ALL`;
      const entriesCountResult = await db.query(entriesCountQuery);
      const entriesCount = (entriesCountResult[0] as any[])?.[0]?.count || 0;
    
      return {
        crewMemberCount: crewCount,
        recognitionEntryCount: entriesCount,
      };
    }),
});
