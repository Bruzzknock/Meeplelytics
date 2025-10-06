@echo off
REM Start the Meeplelytics API server in development mode
npm --workspace server run dev
set EXITCODE=%errorlevel%
if not %EXITCODE%==0 (
    echo.
    echo Meeplelytics API server exited with error code %EXITCODE%.
    echo Press any key to close this window.
    pause >nul
    exit /b %EXITCODE%
)
