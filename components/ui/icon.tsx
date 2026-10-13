import type { JSX } from 'react';
import type { Icon as PhosphorIcon, IconProps, IconWeight } from '@phosphor-icons/react';
import {
  ArrowClockwiseIcon as PhArrowClockwise,
  ArrowCounterClockwiseIcon as PhArrowCounterClockwise,
  ArrowLeftIcon as PhArrowLeft,
  ArrowRightIcon as PhArrowRight,
  ArrowSquareOutIcon as PhArrowSquareOut,
  ArrowsClockwiseIcon as PhArrowsClockwise,
  BarbellIcon as PhBarbell,
  BatteryChargingIcon as PhBatteryCharging,
  BatteryLowIcon as PhBatteryLow,
  BuildingsIcon as PhBuildings,
  CalculatorIcon as PhCalculator,
  CalendarCheckIcon as PhCalendarCheck,
  CalendarDotsIcon as PhCalendarDots,
  CalendarIcon as PhCalendar,
  CameraIcon as PhCamera,
  CaretDownIcon as PhCaretDown,
  CaretLeftIcon as PhCaretLeft,
  CaretRightIcon as PhCaretRight,
  CaretUpIcon as PhCaretUp,
  ChartLineUpIcon as PhChartLineUp,
  ChatCenteredDotsIcon as PhChatCenteredDots,
  ChatCircleIcon as PhChatCircle,
  ChatTextIcon as PhChatText,
  CheckIcon as PhCheck,
  CircleIcon as PhCircle,
  CircleNotchIcon as PhCircleNotch,
  ClipboardTextIcon as PhClipboardText,
  ClockCounterClockwiseIcon as PhClockCounterClockwise,
  ClockIcon as PhClock,
  CloudArrowUpIcon as PhCloudArrowUp,
  CloudCheckIcon as PhCloudCheck,
  CloudSlashIcon as PhCloudSlash,
  CopyIcon as PhCopy,
  DeviceMobileIcon as PhDeviceMobile,
  DotsThreeIcon as PhDotsThree,
  DownloadSimpleIcon as PhDownloadSimple,
  EyeIcon as PhEye,
  FastForwardIcon as PhFastForward,
  FileArrowUpIcon as PhFileArrowUp,
  FilesIcon as PhFiles,
  FireIcon as PhFire,
  FlagIcon as PhFlag,
  FloppyDiskIcon as PhFloppyDisk,
  FunnelIcon as PhFunnel,
  GaugeIcon as PhGauge,
  GearIcon as PhGear,
  HeartbeatIcon as PhHeartbeat,
  HouseIcon as PhHouse,
  InfoIcon as PhInfo,
  KeyIcon as PhKey,
  LayoutIcon as PhLayout,
  LightbulbIcon as PhLightbulb,
  LightningIcon as PhLightning,
  LinkBreakIcon as PhLinkBreak,
  LinkIcon as PhLink,
  ListChecksIcon as PhListChecks,
  ListNumbersIcon as PhListNumbers,
  LockKeyIcon as PhLockKey,
  MagicWandIcon as PhMagicWand,
  MagnifyingGlassIcon as PhMagnifyingGlass,
  MinusIcon as PhMinus,
  MonitorIcon as PhMonitor,
  MoonIcon as PhMoon,
  PaperPlaneRightIcon as PhPaperPlaneRight,
  PauseIcon as PhPause,
  PencilSimpleIcon as PhPencilSimple,
  PlayCircleIcon as PhPlayCircle,
  PlayIcon as PhPlay,
  PlugIcon as PhPlug,
  PlusIcon as PhPlus,
  PrinterIcon as PhPrinter,
  PulseIcon as PhPulse,
  QuestionIcon as PhQuestion,
  RadioButtonIcon as PhRadioButton,
  RulerIcon as PhRuler,
  ScalesIcon as PhScales,
  ShieldCheckIcon as PhShieldCheck,
  ShieldWarningIcon as PhShieldWarning,
  SignOutIcon as PhSignOut,
  SkipBackIcon as PhSkipBack,
  SkipForwardIcon as PhSkipForward,
  SlidersHorizontalIcon as PhSlidersHorizontal,
  SparkleIcon as PhSparkle,
  SpeakerHighIcon as PhSpeakerHigh,
  StackIcon as PhStack,
  SunIcon as PhSun,
  SwapIcon as PhSwap,
  TargetIcon as PhTarget,
  TimerIcon as PhTimer,
  TranslateIcon as PhTranslate,
  TrashIcon as PhTrash,
  TrendDownIcon as PhTrendDown,
  TrendUpIcon as PhTrendUp,
  TrophyIcon as PhTrophy,
  UploadSimpleIcon as PhUploadSimple,
  UserIcon as PhUser,
  WarningCircleIcon as PhWarningCircle,
  WarningIcon as PhWarning,
  WifiHighIcon as PhWifiHigh,
  WrenchIcon as PhWrench,
  XIcon as PhX,
} from '@phosphor-icons/react/ssr';

// The app's icon set (Phosphor, MIT). One place decides the look: "fill" by
// default, "bold" only for the line glyphs that have nothing to fill (chevrons,
// check, plus/minus, the dots menu, the spinner). Sizing follows the className
// (size-4, size-5…); without one the icon is 24px. Decorative unless it gets an
// aria-label or alt. The SSR build has no React context, so these render in
// server and client components alike.

export type { IconProps, IconWeight };
export type AppIcon = (props: IconProps) => JSX.Element;

const DEFAULT_SIZE = 24;

function icon(Glyph: PhosphorIcon, defaultWeight: IconWeight = 'fill'): AppIcon {
  function AppIconGlyph({ weight = defaultWeight, size = DEFAULT_SIZE, ...props }: IconProps) {
    const labelled = props['aria-label'] != null || props.alt != null;
    return <Glyph aria-hidden={labelled ? undefined : true} weight={weight} size={size} {...props} />;
  }
  AppIconGlyph.displayName = Glyph.displayName;
  return AppIconGlyph;
}

export const ArrowClockwiseIcon = icon(PhArrowClockwise);
export const ArrowCounterClockwiseIcon = icon(PhArrowCounterClockwise);
export const ArrowLeftIcon = icon(PhArrowLeft);
export const ArrowRightIcon = icon(PhArrowRight);
export const ArrowSquareOutIcon = icon(PhArrowSquareOut);
export const ArrowsClockwiseIcon = icon(PhArrowsClockwise);
export const BarbellIcon = icon(PhBarbell);
export const BatteryChargingIcon = icon(PhBatteryCharging);
export const BatteryLowIcon = icon(PhBatteryLow);
export const BuildingsIcon = icon(PhBuildings);
export const CalculatorIcon = icon(PhCalculator);
export const CalendarCheckIcon = icon(PhCalendarCheck);
export const CalendarDotsIcon = icon(PhCalendarDots);
export const CalendarIcon = icon(PhCalendar);
export const CameraIcon = icon(PhCamera);
export const CaretDownIcon = icon(PhCaretDown, 'bold');
export const CaretLeftIcon = icon(PhCaretLeft, 'bold');
export const CaretRightIcon = icon(PhCaretRight, 'bold');
export const CaretUpIcon = icon(PhCaretUp, 'bold');
export const ChartLineUpIcon = icon(PhChartLineUp);
export const ChatCenteredDotsIcon = icon(PhChatCenteredDots);
export const ChatCircleIcon = icon(PhChatCircle);
export const ChatTextIcon = icon(PhChatText);
export const CheckIcon = icon(PhCheck, 'bold');
export const CircleIcon = icon(PhCircle);
export const CircleNotchIcon = icon(PhCircleNotch, 'bold');
export const ClipboardTextIcon = icon(PhClipboardText);
export const ClockCounterClockwiseIcon = icon(PhClockCounterClockwise);
export const ClockIcon = icon(PhClock);
export const CloudArrowUpIcon = icon(PhCloudArrowUp);
export const CloudCheckIcon = icon(PhCloudCheck);
export const CloudSlashIcon = icon(PhCloudSlash);
export const CopyIcon = icon(PhCopy);
export const DeviceMobileIcon = icon(PhDeviceMobile);
export const DotsThreeIcon = icon(PhDotsThree, 'bold');
export const DownloadSimpleIcon = icon(PhDownloadSimple);
export const EyeIcon = icon(PhEye);
export const FastForwardIcon = icon(PhFastForward);
export const FileArrowUpIcon = icon(PhFileArrowUp);
export const FilesIcon = icon(PhFiles);
export const FireIcon = icon(PhFire);
export const FlagIcon = icon(PhFlag);
export const FloppyDiskIcon = icon(PhFloppyDisk);
export const FunnelIcon = icon(PhFunnel);
export const GaugeIcon = icon(PhGauge);
export const GearIcon = icon(PhGear);
export const HeartbeatIcon = icon(PhHeartbeat);
export const HouseIcon = icon(PhHouse);
export const InfoIcon = icon(PhInfo);
export const KeyIcon = icon(PhKey);
export const LayoutIcon = icon(PhLayout);
export const LightbulbIcon = icon(PhLightbulb);
export const LightningIcon = icon(PhLightning);
export const LinkBreakIcon = icon(PhLinkBreak);
export const LinkIcon = icon(PhLink);
export const ListChecksIcon = icon(PhListChecks);
export const ListNumbersIcon = icon(PhListNumbers);
export const LockKeyIcon = icon(PhLockKey);
export const MagicWandIcon = icon(PhMagicWand);
export const MagnifyingGlassIcon = icon(PhMagnifyingGlass);
export const MinusIcon = icon(PhMinus, 'bold');
export const MonitorIcon = icon(PhMonitor);
export const MoonIcon = icon(PhMoon);
export const PaperPlaneRightIcon = icon(PhPaperPlaneRight);
export const PauseIcon = icon(PhPause);
export const PencilSimpleIcon = icon(PhPencilSimple);
export const PlayCircleIcon = icon(PhPlayCircle);
export const PlayIcon = icon(PhPlay);
export const PlugIcon = icon(PhPlug);
export const PlusIcon = icon(PhPlus, 'bold');
export const PrinterIcon = icon(PhPrinter);
export const PulseIcon = icon(PhPulse);
export const QuestionIcon = icon(PhQuestion);
export const RadioButtonIcon = icon(PhRadioButton);
export const RulerIcon = icon(PhRuler);
export const ScalesIcon = icon(PhScales);
export const ShieldCheckIcon = icon(PhShieldCheck);
export const ShieldWarningIcon = icon(PhShieldWarning);
export const SignOutIcon = icon(PhSignOut);
export const SkipBackIcon = icon(PhSkipBack);
export const SkipForwardIcon = icon(PhSkipForward);
export const SlidersHorizontalIcon = icon(PhSlidersHorizontal);
export const SparkleIcon = icon(PhSparkle);
export const SpeakerHighIcon = icon(PhSpeakerHigh);
export const StackIcon = icon(PhStack);
export const SunIcon = icon(PhSun);
export const SwapIcon = icon(PhSwap);
export const TargetIcon = icon(PhTarget);
export const TimerIcon = icon(PhTimer);
export const TranslateIcon = icon(PhTranslate);
export const TrashIcon = icon(PhTrash);
export const TrendDownIcon = icon(PhTrendDown);
export const TrendUpIcon = icon(PhTrendUp);
export const TrophyIcon = icon(PhTrophy);
export const UploadSimpleIcon = icon(PhUploadSimple);
export const UserIcon = icon(PhUser);
export const WarningCircleIcon = icon(PhWarningCircle);
export const WarningIcon = icon(PhWarning);
export const WifiHighIcon = icon(PhWifiHigh);
export const WrenchIcon = icon(PhWrench);
export const XIcon = icon(PhX);
