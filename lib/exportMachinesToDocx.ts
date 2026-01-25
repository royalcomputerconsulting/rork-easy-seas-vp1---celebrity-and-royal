import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, PageBreak } from 'docx';
import { Platform } from 'react-native';
import type { MachineEncyclopediaEntry } from '@/types/models';
import * as Sharing from 'expo-sharing';
import { machineIndexHelper } from '@/lib/machineIndexHelper';

function parseVerboseText(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = text.split('\n');
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (!line) {
      i++;
      continue;
    }
    
    if (line === '⸻') {
      paragraphs.push(
        new Paragraph({
          text: '_______________________________________________',
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
        })
      );
      i++;
      continue;
    }
    
    const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
    const isHeaderWithSeparator = nextLine === '⸻';
    
    const isAllCapsHeader = line.length > 3 && line === line.toUpperCase() && /^[A-Z\s\-—()]+$/.test(line);
    
    if (isHeaderWithSeparator || (isAllCapsHeader && !line.startsWith('•') && !line.match(/^\d+\./))) {
      paragraphs.push(
        new Paragraph({
          text: line,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 150 },
        })
      );
      if (isHeaderWithSeparator) {
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    
    if (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\.\s/)) {
      const bulletText = line.replace(/^[•\-]\s*/, '').replace(/^\d+\.\s*/, '');
      paragraphs.push(
        new Paragraph({
          text: `• ${bulletText}`,
          spacing: { after: 100 },
          indent: { left: 360 },
        })
      );
      i++;
      continue;
    }
    
    if (line.match(/^\t•/) || line.match(/^\s{2,}•/)) {
      const bulletText = line.replace(/^\s*•\s*/, '');
      paragraphs.push(
        new Paragraph({
          text: `  ◦ ${bulletText}`,
          spacing: { after: 80 },
          indent: { left: 720 },
        })
      );
      i++;
      continue;
    }
    
    paragraphs.push(
      new Paragraph({
        text: line,
        spacing: { after: 150 },
      })
    );
    i++;
  }
  
  return paragraphs;
}

export async function exportSingleMachineToDocx(machine: MachineEncyclopediaEntry): Promise<void> {
  console.log(`[ExportDocx] Exporting single machine: ${machine.machineName}`);
  await exportFavoriteMachinesToDocx([machine]);
}

export async function exportAllMachinesToTxt(machines: MachineEncyclopediaEntry[]): Promise<void> {
  if (machines.length === 0) {
    throw new Error('No machines to export');
  }

  console.log(`[ExportTxt] Exporting ${machines.length} machines to TXT...`);

  let textContent = 'Complete Slot Machine Database Export\n';
  textContent += `Exported: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}\n`;
  textContent += `Total Machines: ${machines.length}\n`;
  textContent += '='.repeat(80) + '\n\n';

  machines.forEach((machine, index) => {
    const anyMachine = machine as any;

    if (index > 0) {
      textContent += '\n' + '='.repeat(80) + '\n\n';
    }

    textContent += `${index + 1}. ${machine.machineName}${anyMachine.gameSeries ? ` — ${anyMachine.gameSeries}` : ''}\n`;
    textContent += '-'.repeat(80) + '\n\n';

    textContent += `Machine ID: ${machine.id || 'N/A'}\n`;
    if (anyMachine.globalMachineId) {
      textContent += `Global Machine ID: ${anyMachine.globalMachineId}\n`;
    }
    textContent += `Manufacturer: ${machine.manufacturer}\n`;
    if (anyMachine.gameSeries) {
      textContent += `Game Series: ${anyMachine.gameSeries}\n`;
    }
    textContent += `Volatility: ${machine.volatility}\n`;
    textContent += `Cabinet Type: ${machine.cabinetType}\n`;
    if (machine.releaseYear) {
      textContent += `Release Year: ${machine.releaseYear}\n`;
    }
    if (machine.theme) {
      textContent += `Theme: ${machine.theme}\n`;
    }
    if (machine.rtpRanges) {
      textContent += `RTP Range: ${machine.rtpRanges.min}% - ${machine.rtpRanges.max}%\n`;
    }
    if (anyMachine.description) {
      textContent += `Description: ${anyMachine.description}\n`;
    }
    if (machine.basePaytable) {
      textContent += `Base Paytable: ${machine.basePaytable}\n`;
    }
    if (machine.bonusMechanics) {
      textContent += `Bonus Mechanics: ${machine.bonusMechanics}\n`;
    }
    if (machine.jackpotTypes && Array.isArray(machine.jackpotTypes) && machine.jackpotTypes.length > 0) {
      textContent += `Jackpot Types: ${machine.jackpotTypes.join(', ')}\n`;
    }
    if (machine.denominationFamilies && Array.isArray(machine.denominationFamilies) && machine.denominationFamilies.length > 0) {
      textContent += `Denomination Families: ${machine.denominationFamilies.join(', ')}\n`;
    }
    if (anyMachine.isInMyAtlas !== undefined) {
      textContent += `In My Atlas: ${anyMachine.isInMyAtlas ? 'Yes' : 'No'}\n`;
    }
    if (anyMachine.addedToAtlasAt) {
      textContent += `Added to Atlas: ${new Date(anyMachine.addedToAtlasAt).toLocaleDateString()}\n`;
    }
    if (anyMachine.isFavorite !== undefined) {
      textContent += `Favorited: ${anyMachine.isFavorite ? 'Yes' : 'No'}\n`;
    }
    if (anyMachine.favoritedAt) {
      textContent += `Favorited At: ${new Date(anyMachine.favoritedAt).toLocaleDateString()}\n`;
    }
    if (machine.createdAt) {
      textContent += `Created: ${new Date(machine.createdAt).toLocaleDateString()}\n`;
    }
    if (machine.updatedAt) {
      textContent += `Last Updated: ${new Date(machine.updatedAt).toLocaleDateString()}\n`;
    }

    if (machine.apMetadata) {
      textContent += '\n--- ADVANTAGE PLAY INFORMATION ---\n';
      textContent += `Persistence Type: ${machine.apMetadata.persistenceType}\n`;
      textContent += `Has Must-Hit-By: ${machine.apMetadata.hasMustHitBy ? 'Yes' : 'No'}\n`;

      if (machine.apMetadata.mhbThresholds) {
        textContent += '\nMust-Hit-By Thresholds:\n';
        if (machine.apMetadata.mhbThresholds.minor) textContent += `  Minor: ${machine.apMetadata.mhbThresholds.minor}\n`;
        if (machine.apMetadata.mhbThresholds.major) textContent += `  Major: ${machine.apMetadata.mhbThresholds.major}\n`;
        if (machine.apMetadata.mhbThresholds.grand) textContent += `  Grand: ${machine.apMetadata.mhbThresholds.grand}\n`;
        if (machine.apMetadata.mhbThresholds.mega) textContent += `  Mega: ${machine.apMetadata.mhbThresholds.mega}\n`;
      }

      if (machine.apMetadata.entryConditions && machine.apMetadata.entryConditions.length > 0) {
        textContent += '\nAP Entry Conditions:\n';
        machine.apMetadata.entryConditions.forEach(condition => {
          textContent += `  • ${condition}\n`;
        });
      }

      if (machine.apMetadata.exitConditions && machine.apMetadata.exitConditions.length > 0) {
        textContent += '\nWalk Away Conditions:\n';
        machine.apMetadata.exitConditions.forEach(condition => {
          textContent += `  • ${condition}\n`;
        });
      }

      if (machine.apMetadata.risks && machine.apMetadata.risks.length > 0) {
        textContent += '\nRisks:\n';
        machine.apMetadata.risks.forEach(risk => {
          textContent += `  • ${risk}\n`;
        });
      }

      if (machine.apMetadata.recommendedBankroll) {
        textContent += `\nRecommended Bankroll: ${machine.apMetadata.recommendedBankroll.min} - ${machine.apMetadata.recommendedBankroll.max}\n`;
      }

      if (machine.apMetadata.resetValues) {
        textContent += '\nReset Values:\n';
        if (machine.apMetadata.resetValues.mini) textContent += `  Mini: ${machine.apMetadata.resetValues.mini}\n`;
        if (machine.apMetadata.resetValues.minor) textContent += `  Minor: ${machine.apMetadata.resetValues.minor}\n`;
        if (machine.apMetadata.resetValues.major) textContent += `  Major: ${machine.apMetadata.resetValues.major}\n`;
        if (machine.apMetadata.resetValues.grand) textContent += `  Grand: ${machine.apMetadata.resetValues.grand}\n`;
        if (machine.apMetadata.resetValues.mega) textContent += `  Mega: ${machine.apMetadata.resetValues.mega}\n`;
      }

      if (machine.apMetadata.bonusVolatility) {
        textContent += `Bonus Volatility: ${machine.apMetadata.bonusVolatility}\n`;
      }

      if (machine.apMetadata.expectedAPReturn) {
        textContent += `Expected AP Return: ${machine.apMetadata.expectedAPReturn}%\n`;
      }

      if (machine.apMetadata.notesAndTips) {
        textContent += `\nAP Notes & Tips:\n${machine.apMetadata.notesAndTips}\n`;
      }
    }

    if (anyMachine.summary) {
      textContent += '\n--- FULL VERBOSE REFERENCE ---\n';
      textContent += `${anyMachine.summary}\n`;
    }

    if (anyMachine.coreMechanics) {
      textContent += '\n--- CORE MECHANICS ---\n';
      textContent += `${anyMachine.coreMechanics}\n`;
    }

    if (anyMachine.apTriggers) {
      textContent += '\n--- AP TRIGGERS ---\n';
      if (Array.isArray(anyMachine.apTriggers)) {
        anyMachine.apTriggers.forEach((trigger: string) => {
          textContent += `  • ${trigger}\n`;
        });
      } else {
        textContent += `${anyMachine.apTriggers}\n`;
      }
    }

    if (anyMachine.walkAway) {
      textContent += '\n--- WALK AWAY CONDITIONS ---\n';
      if (Array.isArray(anyMachine.walkAway)) {
        anyMachine.walkAway.forEach((condition: string) => {
          textContent += `  • ${condition}\n`;
        });
      } else {
        textContent += `${anyMachine.walkAway}\n`;
      }
    }

    if (anyMachine.denominations && Array.isArray(anyMachine.denominations) && anyMachine.denominations.length > 0) {
      textContent += `\nDenominations: ${anyMachine.denominations.join(', ')}\n`;
    }

    if (anyMachine.jackpotReset) {
      textContent += '\n--- JACKPOT RESET VALUES ---\n';
      if (typeof anyMachine.jackpotReset === 'object') {
        Object.entries(anyMachine.jackpotReset).forEach(([level, value]) => {
          textContent += `  ${level.charAt(0).toUpperCase() + level.slice(1)}: ${value}\n`;
        });
      } else {
        textContent += `${anyMachine.jackpotReset}\n`;
      }
    }

    if (anyMachine.simpleSummary) {
      textContent += '\n--- QUICK SUMMARY ---\n';
      textContent += `${anyMachine.simpleSummary}\n`;
    }

    if (anyMachine.shipNotes) {
      textContent += '\n--- SHIP NOTES ---\n';
      textContent += `${anyMachine.shipNotes}\n`;
    }

    if (machine.shipAssignments && machine.shipAssignments.length > 0) {
      textContent += '\n--- SHIP ASSIGNMENTS ---\n';
      machine.shipAssignments.forEach(assignment => {
        textContent += `  ${assignment.shipName}: ${assignment.notes || 'No notes'}\n`;
        if (assignment.deckLocations && assignment.deckLocations.length > 0) {
          textContent += `    Deck Locations: ${assignment.deckLocations.join(', ')}\n`;
        }
      });
    }

    if (machine.detailedProfile) {
      textContent += '\n--- DETAILED PROFILE ---\n';
      
      if (machine.detailedProfile.simpleSummary) {
        textContent += '\nDetailed Summary:\n';
        textContent += `${machine.detailedProfile.simpleSummary}\n`;
      }

      if (machine.detailedProfile.jackpotResetValues) {
        textContent += '\nJackpot Reset Value Ranges:\n';
        const jrv = machine.detailedProfile.jackpotResetValues;
        if (jrv.mini) textContent += `  Mini: ${jrv.mini.min} - ${jrv.mini.max}\n`;
        if (jrv.minor) textContent += `  Minor: ${jrv.minor.min} - ${jrv.minor.max}\n`;
        if (jrv.major) textContent += `  Major: ${jrv.major.min} - ${jrv.major.max}\n`;
        if (jrv.grand) textContent += `  Grand: ${jrv.grand.min} - ${jrv.grand.max}\n`;
        if (jrv.mega) textContent += `  Mega: ${jrv.mega.min} - ${jrv.mega.max}\n`;
      }

      if (machine.detailedProfile.progressiveBehavior) {
        textContent += '\nProgressive Behavior:\n';
        const pb = machine.detailedProfile.progressiveBehavior;
        if (pb.sharedAcrossBank !== undefined) textContent += `  Shared Across Bank: ${pb.sharedAcrossBank ? 'Yes' : 'No'}\n`;
        if (pb.growthRate) textContent += `  Growth Rate: ${pb.growthRate}\n`;
        if (pb.independentPots !== undefined) textContent += `  Independent Pots: ${pb.independentPots ? 'Yes' : 'No'}\n`;
        if (pb.notes) textContent += `  Notes: ${pb.notes}\n`;
      }

      if (machine.detailedProfile.specialMechanics) {
        textContent += '\nSpecial Mechanics:\n';
        const sm = machine.detailedProfile.specialMechanics;
        textContent += `  ${sm.description}\n`;
        if (sm.triggers && sm.triggers.length > 0) {
          textContent += '  Triggers:\n';
          sm.triggers.forEach(t => textContent += `    • ${t}\n`);
        }
        if (sm.bonusFeatures && sm.bonusFeatures.length > 0) {
          textContent += '  Bonus Features:\n';
          sm.bonusFeatures.forEach(f => textContent += `    • ${f}\n`);
        }
        if (sm.symbolBehavior) textContent += `  Symbol Behavior: ${sm.symbolBehavior}\n`;
        if (sm.bestCombos && sm.bestCombos.length > 0) {
          textContent += '  Best Combos:\n';
          sm.bestCombos.forEach(c => textContent += `    • ${c}\n`);
        }
      }

      if (machine.detailedProfile.bonusGameBehavior) {
        textContent += '\nBonus Game Behavior:\n';
        const bgb = machine.detailedProfile.bonusGameBehavior;
        textContent += `  ${bgb.description}\n`;
        if (bgb.features && bgb.features.length > 0) {
          textContent += '  Features:\n';
          bgb.features.forEach(f => textContent += `    • ${f}\n`);
        }
        if (bgb.volatilityNotes) textContent += `  Volatility Notes: ${bgb.volatilityNotes}\n`;
      }

      if (machine.detailedProfile.denominationBehavior && machine.detailedProfile.denominationBehavior.length > 0) {
        textContent += '\nDenomination Behavior:\n';
        machine.detailedProfile.denominationBehavior.forEach(db => {
          textContent += `  ${db.denom}: ${db.notes}`;
          if (db.recommendation) textContent += ` (${db.recommendation})`;
          textContent += '\n';
        });
      }

      if (machine.detailedProfile.apTriggers) {
        textContent += '\nDetailed AP Triggers:\n';
        const apt = machine.detailedProfile.apTriggers;
        if (apt.primary && apt.primary.length > 0) {
          textContent += '  Primary Triggers:\n';
          apt.primary.forEach(t => textContent += `    • ${t}\n`);
        }
        if (apt.secondary && apt.secondary.length > 0) {
          textContent += '  Secondary Triggers:\n';
          apt.secondary.forEach(t => textContent += `    • ${t}\n`);
        }
        if (apt.visualClues && apt.visualClues.length > 0) {
          textContent += '  Visual Clues:\n';
          apt.visualClues.forEach(c => textContent += `    • ${c}\n`);
        }
      }

      if (machine.detailedProfile.walkAwayConditions) {
        textContent += '\nDetailed Walk Away Conditions:\n';
        const wac = machine.detailedProfile.walkAwayConditions;
        wac.conditions.forEach(c => textContent += `  • ${c}\n`);
        if (wac.reasoning) textContent += `  Reasoning: ${wac.reasoning}\n`;
      }

      if (machine.detailedProfile.bestDenominationForAP) {
        textContent += `\nBest Denomination for AP: ${machine.detailedProfile.bestDenominationForAP}\n`;
      }

      if (machine.detailedProfile.cruiseShipNotes) {
        textContent += '\nDetailed Cruise Ship Notes:\n';
        const csn = machine.detailedProfile.cruiseShipNotes;
        if (csn.reelStripDifferences) textContent += `  Reel Strip Differences: ${csn.reelStripDifferences}\n`;
        if (csn.triggerFrequency) textContent += `  Trigger Frequency: ${csn.triggerFrequency}\n`;
        if (csn.placement) textContent += `  Placement: ${csn.placement}\n`;
        if (csn.otherNotes) textContent += `  Other Notes: ${csn.otherNotes}\n`;
      }
    }

    if (machine.userNotes) {
      textContent += '\n--- USER NOTES ---\n';
      textContent += `${machine.userNotes}\n`;
    }

    if (anyMachine.source) {
      textContent += `\nSource: ${anyMachine.source}\n`;
    }

    if (anyMachine.source_verbatim && Array.isArray(anyMachine.source_verbatim) && anyMachine.source_verbatim.length > 0) {
      textContent += `Source Verbatim: ${anyMachine.source_verbatim.join(', ')}\n`;
    }
  });

  if (Platform.OS === 'web') {
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-slot-machines-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('[ExportTxt] Export complete (web)');
  } else {
    const blob = new Blob([textContent], { type: 'text/plain' });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(blob as any, {
        mimeType: 'text/plain',
        dialogTitle: 'Export All Slot Machines',
        UTI: 'public.plain-text',
      });
      console.log('[ExportTxt] Export complete (mobile)');
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }
}

export async function exportAllMachinesIncrementallyToDocx(
  machines: MachineEncyclopediaEntry[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (machines.length === 0) {
    throw new Error('No machines to export');
  }

  console.log(`[ExportDocx] Exporting ${machines.length} machines incrementally...`);

  const docSections: Paragraph[] = [];

  docSections.push(
    new Paragraph({
      text: 'Complete Slot Machine Database Export',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: `Exported: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      text: `Total Machines: ${machines.length}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  for (let i = 0; i < machines.length; i++) {
    const machine = machines[i];
    console.log(`[ExportDocx] Processing machine ${i + 1}/${machines.length}: ${machine.machineName}`);
    
    if (onProgress) {
      onProgress(i + 1, machines.length);
    }

    const globalId = (machine as any).globalMachineId || machine.id.replace('m262-', '');
    console.log(`[ExportDocx] Fetching full details for ${globalId}...`);
    const fullDetails = await machineIndexHelper.getMachineDetails(globalId);
    
    const enrichedMachine = fullDetails ? { ...machine, ...fullDetails } : machine;
    
    const machineSections = buildMachineSections(enrichedMachine as any, i);
    docSections.push(...machineSections);

    if (i % 10 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  console.log('[ExportDocx] Creating document...');
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docSections,
      },
    ],
  });

  console.log('[ExportDocx] Generating blob...');
  const blob = await Packer.toBlob(doc);
  
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-slot-machines-${new Date().toISOString().split('T')[0]}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('[ExportDocx] Export complete (web)');
  } else {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(blob as any, {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle: 'Export All Slot Machines',
        UTI: 'org.openxmlformats.wordprocessingml.document',
      });
      console.log('[ExportDocx] Export complete (mobile)');
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }
}

function buildMachineSections(machine: MachineEncyclopediaEntry, index: number): Paragraph[] {
  const sections: Paragraph[] = [];
  const anyMachine = machine as any;

  if (index > 0) {
    sections.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  }

  sections.push(
    new Paragraph({
      text: `${index + 1}. ${machine.machineName}${anyMachine.gameSeries ? ` — ${anyMachine.gameSeries}` : ''}`,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 400 },
      border: {
        bottom: {
          color: '0A1F44',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
    })
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Machine ID: ', bold: true }),
        new TextRun({ text: machine.id || 'N/A' }),
      ],
      spacing: { after: 100 },
    })
  );

  if (anyMachine.globalMachineId) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Global Machine ID: ', bold: true }),
          new TextRun({ text: anyMachine.globalMachineId }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Manufacturer: ', bold: true }),
        new TextRun({ text: machine.manufacturer }),
      ],
      spacing: { after: 100 },
    })
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Volatility: ', bold: true }),
        new TextRun({ text: machine.volatility }),
      ],
      spacing: { after: 100 },
    })
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Cabinet Type: ', bold: true }),
        new TextRun({ text: machine.cabinetType }),
      ],
      spacing: { after: 100 },
    })
  );

  if (machine.releaseYear) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Release Year: ', bold: true }),
          new TextRun({ text: machine.releaseYear.toString() }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  if (machine.theme) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Theme: ', bold: true }),
          new TextRun({ text: machine.theme }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  if (machine.apMetadata) {
    sections.push(
      new Paragraph({
        text: 'Advantage Play Information',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Persistence Type: ', bold: true }),
          new TextRun({ text: machine.apMetadata.persistenceType }),
        ],
        spacing: { after: 100 },
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Has Must-Hit-By: ', bold: true }),
          new TextRun({ text: machine.apMetadata.hasMustHitBy ? 'Yes' : 'No' }),
        ],
        spacing: { after: 100 },
      })
    );

    if (machine.apMetadata.entryConditions && machine.apMetadata.entryConditions.length > 0) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'AP Entry Conditions:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      machine.apMetadata.entryConditions.forEach(condition => {
        sections.push(
          new Paragraph({
            text: `• ${condition}`,
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      });
    }

    if (machine.apMetadata.exitConditions && machine.apMetadata.exitConditions.length > 0) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Walk Away Conditions:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      machine.apMetadata.exitConditions.forEach(condition => {
        sections.push(
          new Paragraph({
            text: `• ${condition}`,
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      });
    }

    if (machine.apMetadata.recommendedBankroll) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Recommended Bankroll: ', bold: true }),
            new TextRun({ 
              text: `${machine.apMetadata.recommendedBankroll.min} - ${machine.apMetadata.recommendedBankroll.max}` 
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );
    }

    if (machine.apMetadata.notesAndTips) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'AP Notes & Tips:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      sections.push(
        new Paragraph({
          text: machine.apMetadata.notesAndTips,
          spacing: { after: 200 },
          indent: { left: 360 },
        })
      );
    }
  }

  if (anyMachine.summary) {
    sections.push(
      new Paragraph({
        text: 'Full Verbose Reference',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    
    const parsedSummary = parseVerboseText(anyMachine.summary);
    sections.push(...parsedSummary);
  }

  if (anyMachine.coreMechanics) {
    sections.push(
      new Paragraph({
        text: 'Core Mechanics',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    sections.push(
      new Paragraph({
        text: anyMachine.coreMechanics,
        spacing: { after: 200 },
      })
    );
  }

  if (anyMachine.apTriggers) {
    sections.push(
      new Paragraph({
        text: 'AP Triggers',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    if (Array.isArray(anyMachine.apTriggers)) {
      anyMachine.apTriggers.forEach((trigger: string) => {
        sections.push(
          new Paragraph({
            text: `• ${trigger}`,
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      });
    } else {
      sections.push(
        new Paragraph({
          text: anyMachine.apTriggers,
          spacing: { after: 200 },
        })
      );
    }
  }

  if (anyMachine.walkAway) {
    sections.push(
      new Paragraph({
        text: 'Walk Away Conditions',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    if (Array.isArray(anyMachine.walkAway)) {
      anyMachine.walkAway.forEach((condition: string) => {
        sections.push(
          new Paragraph({
            text: `• ${condition}`,
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      });
    } else {
      sections.push(
        new Paragraph({
          text: anyMachine.walkAway,
          spacing: { after: 200 },
        })
      );
    }
  }

  if (anyMachine.denominations && Array.isArray(anyMachine.denominations) && anyMachine.denominations.length > 0) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Denominations: ', bold: true }),
          new TextRun({ text: anyMachine.denominations.join(', ') }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );
  }

  if (anyMachine.jackpotReset) {
    sections.push(
      new Paragraph({
        text: 'Jackpot Reset Values',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    if (typeof anyMachine.jackpotReset === 'object') {
      Object.entries(anyMachine.jackpotReset).forEach(([level, value]) => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${level.charAt(0).toUpperCase() + level.slice(1)}: `, bold: true }),
              new TextRun({ text: String(value) }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      });
    } else {
      sections.push(
        new Paragraph({
          text: String(anyMachine.jackpotReset),
          spacing: { after: 200 },
          indent: { left: 360 },
        })
      );
    }
  }

  if (anyMachine.simpleSummary) {
    sections.push(
      new Paragraph({
        text: 'Quick Summary',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    sections.push(
      new Paragraph({
        text: anyMachine.simpleSummary,
        spacing: { after: 200 },
      })
    );
  }

  if (anyMachine.shipNotes) {
    sections.push(
      new Paragraph({
        text: 'Ship Notes',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    sections.push(
      new Paragraph({
        text: anyMachine.shipNotes,
        spacing: { after: 200 },
      })
    );
  }

  if (machine.shipAssignments && machine.shipAssignments.length > 0) {
    sections.push(
      new Paragraph({
        text: 'Ship Assignments',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    machine.shipAssignments.forEach(assignment => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${assignment.shipName}: `, bold: true }),
            new TextRun({ text: assignment.notes || 'No notes' }),
          ],
          spacing: { after: 100 },
          indent: { left: 360 },
        })
      );
      if (assignment.deckLocations && assignment.deckLocations.length > 0) {
        sections.push(
          new Paragraph({
            text: `Deck Locations: ${assignment.deckLocations.join(', ')}`,
            spacing: { after: 50 },
            indent: { left: 720 },
          })
        );
      }
    });
  }

  if (machine.detailedProfile) {
    sections.push(
      new Paragraph({
        text: 'Detailed Profile',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );
    
    if (machine.detailedProfile.simpleSummary) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Detailed Summary:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      sections.push(
        new Paragraph({
          text: machine.detailedProfile.simpleSummary,
          spacing: { after: 200 },
          indent: { left: 360 },
        })
      );
    }

    if (machine.detailedProfile.jackpotResetValues) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Jackpot Reset Value Ranges:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      const jrv = machine.detailedProfile.jackpotResetValues;
      if (jrv.mini) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Mini: ', bold: true }),
              new TextRun({ text: `${jrv.mini.min} - ${jrv.mini.max}` }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (jrv.minor) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Minor: ', bold: true }),
              new TextRun({ text: `${jrv.minor.min} - ${jrv.minor.max}` }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (jrv.major) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Major: ', bold: true }),
              new TextRun({ text: `${jrv.major.min} - ${jrv.major.max}` }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (jrv.grand) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Grand: ', bold: true }),
              new TextRun({ text: `${jrv.grand.min} - ${jrv.grand.max}` }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (jrv.mega) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Mega: ', bold: true }),
              new TextRun({ text: `${jrv.mega.min} - ${jrv.mega.max}` }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
    }

    if (machine.detailedProfile.progressiveBehavior) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Progressive Behavior:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      const pb = machine.detailedProfile.progressiveBehavior;
      if (pb.sharedAcrossBank !== undefined) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Shared Across Bank: ', bold: true }),
              new TextRun({ text: pb.sharedAcrossBank ? 'Yes' : 'No' }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (pb.growthRate) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Growth Rate: ', bold: true }),
              new TextRun({ text: pb.growthRate }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (pb.independentPots !== undefined) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Independent Pots: ', bold: true }),
              new TextRun({ text: pb.independentPots ? 'Yes' : 'No' }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (pb.notes) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Notes: ', bold: true }),
              new TextRun({ text: pb.notes }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
    }

    if (machine.detailedProfile.specialMechanics) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Special Mechanics:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      const sm = machine.detailedProfile.specialMechanics;
      sections.push(
        new Paragraph({
          text: sm.description,
          spacing: { after: 100 },
          indent: { left: 360 },
        })
      );
      if (sm.triggers && sm.triggers.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Triggers:', bold: true })],
            spacing: { before: 100, after: 50 },
            indent: { left: 360 },
          })
        );
        sm.triggers.forEach(t => {
          sections.push(
            new Paragraph({
              text: `• ${t}`,
              spacing: { after: 30 },
              indent: { left: 720 },
            })
          );
        });
      }
      if (sm.bonusFeatures && sm.bonusFeatures.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Bonus Features:', bold: true })],
            spacing: { before: 100, after: 50 },
            indent: { left: 360 },
          })
        );
        sm.bonusFeatures.forEach(f => {
          sections.push(
            new Paragraph({
              text: `• ${f}`,
              spacing: { after: 30 },
              indent: { left: 720 },
            })
          );
        });
      }
      if (sm.symbolBehavior) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Symbol Behavior: ', bold: true }),
              new TextRun({ text: sm.symbolBehavior }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (sm.bestCombos && sm.bestCombos.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Best Combos:', bold: true })],
            spacing: { before: 100, after: 50 },
            indent: { left: 360 },
          })
        );
        sm.bestCombos.forEach(c => {
          sections.push(
            new Paragraph({
              text: `• ${c}`,
              spacing: { after: 30 },
              indent: { left: 720 },
            })
          );
        });
      }
    }

    if (machine.detailedProfile.bonusGameBehavior) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Bonus Game Behavior:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      const bgb = machine.detailedProfile.bonusGameBehavior;
      sections.push(
        new Paragraph({
          text: bgb.description,
          spacing: { after: 100 },
          indent: { left: 360 },
        })
      );
      if (bgb.features && bgb.features.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Features:', bold: true })],
            spacing: { before: 100, after: 50 },
            indent: { left: 360 },
          })
        );
        bgb.features.forEach(f => {
          sections.push(
            new Paragraph({
              text: `• ${f}`,
              spacing: { after: 30 },
              indent: { left: 720 },
            })
          );
        });
      }
      if (bgb.volatilityNotes) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Volatility Notes: ', bold: true }),
              new TextRun({ text: bgb.volatilityNotes }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
    }

    if (machine.detailedProfile.denominationBehavior && machine.detailedProfile.denominationBehavior.length > 0) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Denomination Behavior:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      machine.detailedProfile.denominationBehavior.forEach(db => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${db.denom}: `, bold: true }),
              new TextRun({ text: db.notes }),
              ...(db.recommendation ? [new TextRun({ text: ` (${db.recommendation})`, italics: true })] : []),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      });
    }

    if (machine.detailedProfile.apTriggers) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Detailed AP Triggers:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      const apt = machine.detailedProfile.apTriggers;
      if (apt.primary && apt.primary.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Primary Triggers:', bold: true })],
            spacing: { before: 100, after: 50 },
            indent: { left: 360 },
          })
        );
        apt.primary.forEach(t => {
          sections.push(
            new Paragraph({
              text: `• ${t}`,
              spacing: { after: 30 },
              indent: { left: 720 },
            })
          );
        });
      }
      if (apt.secondary && apt.secondary.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Secondary Triggers:', bold: true })],
            spacing: { before: 100, after: 50 },
            indent: { left: 360 },
          })
        );
        apt.secondary.forEach(t => {
          sections.push(
            new Paragraph({
              text: `• ${t}`,
              spacing: { after: 30 },
              indent: { left: 720 },
            })
          );
        });
      }
      if (apt.visualClues && apt.visualClues.length > 0) {
        sections.push(
          new Paragraph({
            children: [new TextRun({ text: 'Visual Clues:', bold: true })],
            spacing: { before: 100, after: 50 },
            indent: { left: 360 },
          })
        );
        apt.visualClues.forEach(c => {
          sections.push(
            new Paragraph({
              text: `• ${c}`,
              spacing: { after: 30 },
              indent: { left: 720 },
            })
          );
        });
      }
    }

    if (machine.detailedProfile.walkAwayConditions) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Detailed Walk Away Conditions:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      const wac = machine.detailedProfile.walkAwayConditions;
      wac.conditions.forEach(c => {
        sections.push(
          new Paragraph({
            text: `• ${c}`,
            spacing: { after: 30 },
            indent: { left: 360 },
          })
        );
      });
      if (wac.reasoning) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Reasoning: ', bold: true }),
              new TextRun({ text: wac.reasoning }),
            ],
            spacing: { before: 100, after: 50 },
            indent: { left: 360 },
          })
        );
      }
    }

    if (machine.detailedProfile.bestDenominationForAP) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Best Denomination for AP: ', bold: true }),
            new TextRun({ text: machine.detailedProfile.bestDenominationForAP }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );
    }

    if (machine.detailedProfile.cruiseShipNotes) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Detailed Cruise Ship Notes:', bold: true })
          ],
          spacing: { before: 200, after: 100 },
        })
      );
      const csn = machine.detailedProfile.cruiseShipNotes;
      if (csn.reelStripDifferences) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Reel Strip Differences: ', bold: true }),
              new TextRun({ text: csn.reelStripDifferences }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (csn.triggerFrequency) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Trigger Frequency: ', bold: true }),
              new TextRun({ text: csn.triggerFrequency }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (csn.placement) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Placement: ', bold: true }),
              new TextRun({ text: csn.placement }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
      if (csn.otherNotes) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Other Notes: ', bold: true }),
              new TextRun({ text: csn.otherNotes }),
            ],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      }
    }
  }

  if (machine.userNotes) {
    sections.push(
      new Paragraph({
        text: 'User Notes',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );
    sections.push(
      new Paragraph({
        text: machine.userNotes,
        spacing: { after: 200 },
      })
    );
  }

  if (anyMachine.source) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Source: ', bold: true }),
          new TextRun({ text: anyMachine.source }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );
  }

  if (anyMachine.source_verbatim && Array.isArray(anyMachine.source_verbatim) && anyMachine.source_verbatim.length > 0) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Source Verbatim: ', bold: true }),
          new TextRun({ text: anyMachine.source_verbatim.join(', ') }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  return sections;
}

export async function exportFavoriteMachinesToDocx(machines: MachineEncyclopediaEntry[]): Promise<void> {
  if (machines.length === 0) {
    throw new Error('No favorite machines to export');
  }

  console.log(`[ExportDocx] Exporting ${machines.length} favorite machines...`);

  const docSections: Paragraph[] = [];

  docSections.push(
    new Paragraph({
      text: 'My Favorite Slot Machines - AP Reference',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: `Exported: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({
      text: `Total Machines: ${machines.length}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  machines.forEach((machine, index) => {
    const anyMachine = machine as any;

    if (index > 0) {
      docSections.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    docSections.push(
      new Paragraph({
        text: `${index + 1}. ${machine.machineName}${anyMachine.gameSeries ? ` — ${anyMachine.gameSeries}` : ''}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 400 },
        border: {
          bottom: {
            color: '0A1F44',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );

    docSections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Machine ID: ', bold: true }),
          new TextRun({ text: machine.id || 'N/A' }),
        ],
        spacing: { after: 100 },
      })
    );

    if (anyMachine.globalMachineId) {
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Global Machine ID: ', bold: true }),
            new TextRun({ text: anyMachine.globalMachineId }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    docSections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Manufacturer: ', bold: true }),
          new TextRun({ text: machine.manufacturer }),
        ],
        spacing: { after: 100 },
      })
    );



    docSections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Volatility: ', bold: true }),
          new TextRun({ text: machine.volatility }),
        ],
        spacing: { after: 100 },
      })
    );

    docSections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Cabinet Type: ', bold: true }),
          new TextRun({ text: machine.cabinetType }),
        ],
        spacing: { after: 100 },
      })
    );

    if (machine.releaseYear) {
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Release Year: ', bold: true }),
            new TextRun({ text: machine.releaseYear.toString() }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    if (machine.theme) {
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Theme: ', bold: true }),
            new TextRun({ text: machine.theme }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    if (machine.apMetadata) {
      docSections.push(
        new Paragraph({
          text: 'Advantage Play Information',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );

      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Persistence Type: ', bold: true }),
            new TextRun({ text: machine.apMetadata.persistenceType }),
          ],
          spacing: { after: 100 },
        })
      );

      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Has Must-Hit-By: ', bold: true }),
            new TextRun({ text: machine.apMetadata.hasMustHitBy ? 'Yes' : 'No' }),
          ],
          spacing: { after: 100 },
        })
      );

      if (machine.apMetadata.entryConditions && machine.apMetadata.entryConditions.length > 0) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'AP Entry Conditions:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        machine.apMetadata.entryConditions.forEach(condition => {
          docSections.push(
            new Paragraph({
              text: `• ${condition}`,
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        });
      }

      if (machine.apMetadata.exitConditions && machine.apMetadata.exitConditions.length > 0) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Walk Away Conditions:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        machine.apMetadata.exitConditions.forEach(condition => {
          docSections.push(
            new Paragraph({
              text: `• ${condition}`,
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        });
      }

      if (machine.apMetadata.recommendedBankroll) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Recommended Bankroll: ', bold: true }),
              new TextRun({ 
                text: `$${machine.apMetadata.recommendedBankroll.min} - $${machine.apMetadata.recommendedBankroll.max}` 
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );
      }

      if (machine.apMetadata.notesAndTips) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'AP Notes & Tips:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        docSections.push(
          new Paragraph({
            text: machine.apMetadata.notesAndTips,
            spacing: { after: 200 },
            indent: { left: 360 },
          })
        );
      }
    }

    if (anyMachine.summary) {
      docSections.push(
        new Paragraph({
          text: 'Full Verbose Reference',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      
      const parsedSummary = parseVerboseText(anyMachine.summary);
      docSections.push(...parsedSummary);
    }

    if (anyMachine.coreMechanics) {
      docSections.push(
        new Paragraph({
          text: 'Core Mechanics',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      docSections.push(
        new Paragraph({
          text: anyMachine.coreMechanics,
          spacing: { after: 200 },
        })
      );
    }

    if (anyMachine.apTriggers) {
      docSections.push(
        new Paragraph({
          text: 'AP Triggers',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      if (Array.isArray(anyMachine.apTriggers)) {
        anyMachine.apTriggers.forEach((trigger: string) => {
          docSections.push(
            new Paragraph({
              text: `• ${trigger}`,
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        });
      } else {
        docSections.push(
          new Paragraph({
            text: anyMachine.apTriggers,
            spacing: { after: 200 },
          })
        );
      }
    }

    if (anyMachine.walkAway) {
      docSections.push(
        new Paragraph({
          text: 'Walk Away Conditions',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      if (Array.isArray(anyMachine.walkAway)) {
        anyMachine.walkAway.forEach((condition: string) => {
          docSections.push(
            new Paragraph({
              text: `• ${condition}`,
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        });
      } else {
        docSections.push(
          new Paragraph({
            text: anyMachine.walkAway,
            spacing: { after: 200 },
          })
        );
      }
    }

    if (anyMachine.denominations && Array.isArray(anyMachine.denominations) && anyMachine.denominations.length > 0) {
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Denominations: ', bold: true }),
            new TextRun({ text: anyMachine.denominations.join(', ') }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );
    }

    if (anyMachine.jackpotReset) {
      docSections.push(
        new Paragraph({
          text: 'Jackpot Reset Values',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      if (typeof anyMachine.jackpotReset === 'object') {
        Object.entries(anyMachine.jackpotReset).forEach(([level, value]) => {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${level.charAt(0).toUpperCase() + level.slice(1)}: `, bold: true }),
                new TextRun({ text: String(value) }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        });
      } else {
        docSections.push(
          new Paragraph({
            text: String(anyMachine.jackpotReset),
            spacing: { after: 200 },
            indent: { left: 360 },
          })
        );
      }
    }

    if (anyMachine.simpleSummary) {
      docSections.push(
        new Paragraph({
          text: 'Quick Summary',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      docSections.push(
        new Paragraph({
          text: anyMachine.simpleSummary,
          spacing: { after: 200 },
        })
      );
    }

    if (anyMachine.shipNotes) {
      docSections.push(
        new Paragraph({
          text: 'Ship Notes',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      docSections.push(
        new Paragraph({
          text: anyMachine.shipNotes,
          spacing: { after: 200 },
        })
      );
    }

    if (machine.shipAssignments && machine.shipAssignments.length > 0) {
      docSections.push(
        new Paragraph({
          text: 'Ship Assignments',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      machine.shipAssignments.forEach(assignment => {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${assignment.shipName}: `, bold: true }),
              new TextRun({ text: assignment.notes || 'No notes' }),
            ],
            spacing: { after: 100 },
            indent: { left: 360 },
          })
        );
        if (assignment.deckLocations && assignment.deckLocations.length > 0) {
          docSections.push(
            new Paragraph({
              text: `Deck Locations: ${assignment.deckLocations.join(', ')}`,
              spacing: { after: 50 },
              indent: { left: 720 },
            })
          );
        }
      });
    }

    if (machine.detailedProfile) {
      docSections.push(
        new Paragraph({
          text: 'Detailed Profile',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        })
      );
      
      if (machine.detailedProfile.simpleSummary) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Detailed Summary:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        docSections.push(
          new Paragraph({
            text: machine.detailedProfile.simpleSummary,
            spacing: { after: 200 },
            indent: { left: 360 },
          })
        );
      }

      if (machine.detailedProfile.jackpotResetValues) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Jackpot Reset Value Ranges:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        const jrv = machine.detailedProfile.jackpotResetValues;
        if (jrv.mini) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Mini: ', bold: true }),
                new TextRun({ text: `${jrv.mini.min} - ${jrv.mini.max}` }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (jrv.minor) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Minor: ', bold: true }),
                new TextRun({ text: `${jrv.minor.min} - ${jrv.minor.max}` }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (jrv.major) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Major: ', bold: true }),
                new TextRun({ text: `${jrv.major.min} - ${jrv.major.max}` }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (jrv.grand) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Grand: ', bold: true }),
                new TextRun({ text: `${jrv.grand.min} - ${jrv.grand.max}` }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (jrv.mega) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Mega: ', bold: true }),
                new TextRun({ text: `${jrv.mega.min} - ${jrv.mega.max}` }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
      }

      if (machine.detailedProfile.progressiveBehavior) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Progressive Behavior:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        const pb = machine.detailedProfile.progressiveBehavior;
        if (pb.sharedAcrossBank !== undefined) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Shared Across Bank: ', bold: true }),
                new TextRun({ text: pb.sharedAcrossBank ? 'Yes' : 'No' }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (pb.growthRate) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Growth Rate: ', bold: true }),
                new TextRun({ text: pb.growthRate }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (pb.independentPots !== undefined) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Independent Pots: ', bold: true }),
                new TextRun({ text: pb.independentPots ? 'Yes' : 'No' }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (pb.notes) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Notes: ', bold: true }),
                new TextRun({ text: pb.notes }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
      }

      if (machine.detailedProfile.specialMechanics) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Special Mechanics:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        const sm = machine.detailedProfile.specialMechanics;
        docSections.push(
          new Paragraph({
            text: sm.description,
            spacing: { after: 100 },
            indent: { left: 360 },
          })
        );
        if (sm.triggers && sm.triggers.length > 0) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: 'Triggers:', bold: true })],
              spacing: { before: 100, after: 50 },
              indent: { left: 360 },
            })
          );
          sm.triggers.forEach(t => {
            docSections.push(
              new Paragraph({
                text: `• ${t}`,
                spacing: { after: 30 },
                indent: { left: 720 },
              })
            );
          });
        }
        if (sm.bonusFeatures && sm.bonusFeatures.length > 0) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: 'Bonus Features:', bold: true })],
              spacing: { before: 100, after: 50 },
              indent: { left: 360 },
            })
          );
          sm.bonusFeatures.forEach(f => {
            docSections.push(
              new Paragraph({
                text: `• ${f}`,
                spacing: { after: 30 },
                indent: { left: 720 },
              })
            );
          });
        }
        if (sm.symbolBehavior) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Symbol Behavior: ', bold: true }),
                new TextRun({ text: sm.symbolBehavior }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (sm.bestCombos && sm.bestCombos.length > 0) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: 'Best Combos:', bold: true })],
              spacing: { before: 100, after: 50 },
              indent: { left: 360 },
            })
          );
          sm.bestCombos.forEach(c => {
            docSections.push(
              new Paragraph({
                text: `• ${c}`,
                spacing: { after: 30 },
                indent: { left: 720 },
              })
            );
          });
        }
      }

      if (machine.detailedProfile.bonusGameBehavior) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Bonus Game Behavior:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        const bgb = machine.detailedProfile.bonusGameBehavior;
        docSections.push(
          new Paragraph({
            text: bgb.description,
            spacing: { after: 100 },
            indent: { left: 360 },
          })
        );
        if (bgb.features && bgb.features.length > 0) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: 'Features:', bold: true })],
              spacing: { before: 100, after: 50 },
              indent: { left: 360 },
            })
          );
          bgb.features.forEach(f => {
            docSections.push(
              new Paragraph({
                text: `• ${f}`,
                spacing: { after: 30 },
                indent: { left: 720 },
              })
            );
          });
        }
        if (bgb.volatilityNotes) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Volatility Notes: ', bold: true }),
                new TextRun({ text: bgb.volatilityNotes }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
      }

      if (machine.detailedProfile.denominationBehavior && machine.detailedProfile.denominationBehavior.length > 0) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Denomination Behavior:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        machine.detailedProfile.denominationBehavior.forEach(db => {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${db.denom}: `, bold: true }),
                new TextRun({ text: db.notes }),
                ...(db.recommendation ? [new TextRun({ text: ` (${db.recommendation})`, italics: true })] : []),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        });
      }

      if (machine.detailedProfile.apTriggers) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Detailed AP Triggers:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        const apt = machine.detailedProfile.apTriggers;
        if (apt.primary && apt.primary.length > 0) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: 'Primary Triggers:', bold: true })],
              spacing: { before: 100, after: 50 },
              indent: { left: 360 },
            })
          );
          apt.primary.forEach(t => {
            docSections.push(
              new Paragraph({
                text: `• ${t}`,
                spacing: { after: 30 },
                indent: { left: 720 },
              })
            );
          });
        }
        if (apt.secondary && apt.secondary.length > 0) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: 'Secondary Triggers:', bold: true })],
              spacing: { before: 100, after: 50 },
              indent: { left: 360 },
            })
          );
          apt.secondary.forEach(t => {
            docSections.push(
              new Paragraph({
                text: `• ${t}`,
                spacing: { after: 30 },
                indent: { left: 720 },
              })
            );
          });
        }
        if (apt.visualClues && apt.visualClues.length > 0) {
          docSections.push(
            new Paragraph({
              children: [new TextRun({ text: 'Visual Clues:', bold: true })],
              spacing: { before: 100, after: 50 },
              indent: { left: 360 },
            })
          );
          apt.visualClues.forEach(c => {
            docSections.push(
              new Paragraph({
                text: `• ${c}`,
                spacing: { after: 30 },
                indent: { left: 720 },
              })
            );
          });
        }
      }

      if (machine.detailedProfile.walkAwayConditions) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Detailed Walk Away Conditions:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        const wac = machine.detailedProfile.walkAwayConditions;
        wac.conditions.forEach(c => {
          docSections.push(
            new Paragraph({
              text: `• ${c}`,
              spacing: { after: 30 },
              indent: { left: 360 },
            })
          );
        });
        if (wac.reasoning) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Reasoning: ', bold: true }),
                new TextRun({ text: wac.reasoning }),
              ],
              spacing: { before: 100, after: 50 },
              indent: { left: 360 },
            })
          );
        }
      }

      if (machine.detailedProfile.bestDenominationForAP) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Best Denomination for AP: ', bold: true }),
              new TextRun({ text: machine.detailedProfile.bestDenominationForAP }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );
      }

      if (machine.detailedProfile.cruiseShipNotes) {
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Detailed Cruise Ship Notes:', bold: true })
            ],
            spacing: { before: 200, after: 100 },
          })
        );
        const csn = machine.detailedProfile.cruiseShipNotes;
        if (csn.reelStripDifferences) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Reel Strip Differences: ', bold: true }),
                new TextRun({ text: csn.reelStripDifferences }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (csn.triggerFrequency) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Trigger Frequency: ', bold: true }),
                new TextRun({ text: csn.triggerFrequency }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (csn.placement) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Placement: ', bold: true }),
                new TextRun({ text: csn.placement }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
        if (csn.otherNotes) {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Other Notes: ', bold: true }),
                new TextRun({ text: csn.otherNotes }),
              ],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        }
      }
    }

    if (machine.userNotes) {
      docSections.push(
        new Paragraph({
          text: 'User Notes',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
      docSections.push(
        new Paragraph({
          text: machine.userNotes,
          spacing: { after: 200 },
        })
      );
    }

    if (anyMachine.source) {
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Source: ', bold: true }),
            new TextRun({ text: anyMachine.source }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );
    }

    if (anyMachine.source_verbatim && Array.isArray(anyMachine.source_verbatim) && anyMachine.source_verbatim.length > 0) {
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Source Verbatim: ', bold: true }),
            new TextRun({ text: anyMachine.source_verbatim.join(', ') }),
          ],
          spacing: { after: 100 },
        })
      );
    }


  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docSections,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `favorite-slot-machines-${new Date().toISOString().split('T')[0]}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('[ExportDocx] Export complete (web)');
  } else {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(blob as any, {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle: 'Export Favorite Slot Machines',
        UTI: 'org.openxmlformats.wordprocessingml.document',
      });
      console.log('[ExportDocx] Export complete (mobile) - shared blob directly');
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }
}
