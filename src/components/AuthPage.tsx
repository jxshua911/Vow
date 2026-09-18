import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';
import { NATIVE_OAUTH_REDIRECT } from '@/lib/nativeAuth';
import { Mail, Lock, ArrowRight, ArrowLeft } from '@/lib/ui-icons';
import { GoogleIcon } from './GoogleIcon';
import { BrandLogo } from './BrandLogo';
import { userFacingError } from '@/lib/userFacingError';

